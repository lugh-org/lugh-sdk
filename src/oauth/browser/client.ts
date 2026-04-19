import { createPkcePair } from "./pkce.js";
import { createState } from "./state.js";
import {
  SessionStorageAdapter,
  clearPkceVerifier,
  clearState,
  readPkceVerifier,
  readState,
  savePkceVerifier,
  saveState,
} from "./storage.js";
import { authorizeUrl, revokeUrl, tokenUrl } from "./endpoints.js";
import { EventBus } from "./events.js";
import { DEFAULT_LANGUAGE, type Language } from "./language.js";
import type {
  LughAuthEvent,
  LughAuthEventPayload,
  LughOAuthOptions,
  LughTokens,
  Scope,
  TokenStorage,
} from "./types.js";

const DEFAULT_SCOPE: Scope[] = ["credits"];
const DEFAULT_REFRESH_SKEW_MS = 60_000;

type TokenEndpointResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type ResolvedOptions = {
  clientId: string;
  redirectUri: string;
  apiUrl: string;
  scope: Scope[];
  language: Language;
  storage: TokenStorage;
  autoRefreshSkewMs: number;
  fetchImpl: typeof fetch;
};

// Dedup concurrent flows. React StrictMode double-mounts `LughOAuthClient.init`
// on the same `?code=` URL; the first /token POST succeeds and the server
// drops the PKCE record, so the second 400s with "invalid_grant". A single
// in-flight promise per (module, code) prevents the race.
let inflightCallback: Promise<LughTokens> | null = null;

export class LughOAuthClient {
  private readonly opts: ResolvedOptions;
  private readonly bus = new EventBus();
  private inflightRefresh: Promise<LughTokens> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private cachedTokens: LughTokens | null = null;

  static async init(opts: LughOAuthOptions): Promise<LughOAuthClient> {
    const client = new LughOAuthClient(opts);
    await client.bootstrap();
    return client;
  }

  private constructor(opts: LughOAuthOptions) {
    if (!opts?.clientId) {
      throw new Error("LughOAuthClient: clientId is required");
    }
    if (!opts?.redirectUri) {
      throw new Error("LughOAuthClient: redirectUri is required");
    }
    if (!opts?.apiUrl) {
      throw new Error("LughOAuthClient: apiUrl is required");
    }

    this.opts = {
      clientId: opts.clientId,
      redirectUri: opts.redirectUri,
      apiUrl: opts.apiUrl.replace(/\/+$/, ""),
      scope:
        opts.scope && opts.scope.length > 0 ? [...opts.scope] : DEFAULT_SCOPE,
      language: opts.language ?? DEFAULT_LANGUAGE,
      storage: opts.storage ?? new SessionStorageAdapter(),
      autoRefreshSkewMs: opts.autoRefreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS,
      fetchImpl: opts.fetchImpl ?? globalThis.fetch.bind(globalThis),
    };
  }

  // ------------------------------------------------------------ bootstrap
  private async bootstrap(): Promise<void> {
    this.cachedTokens = await this.opts.storage.read();
    if (this.isCallbackUrl()) {
      try {
        await this.handleCallback();
      } catch (err) {
        // If a concurrent bootstrap already stored fresh tokens (React
        // StrictMode double-invocation), reflect the signed-in state
        // instead of surfacing the stale "code reused" error.
        this.cachedTokens = await this.opts.storage.read();
        if (this.cachedTokens) {
          this.scheduleRefresh();
          return;
        }
        this.bus.emit("error", toError(err));
      }
    }
    this.scheduleRefresh();
  }

  private isCallbackUrl(): boolean {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    return url.searchParams.has("code") || url.searchParams.has("error");
  }

  // ---------------------------------------------------------------- state
  get isSignedIn(): boolean {
    const tokens = this.cachedTokens;
    if (!tokens?.accessToken) return false;
    if (tokens.expiresAt && tokens.expiresAt <= Date.now()) return false;
    return true;
  }

  async getTokens(): Promise<LughTokens | null> {
    if (this.cachedTokens) return this.cachedTokens;
    this.cachedTokens = await this.opts.storage.read();
    return this.cachedTokens;
  }

  async getAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    if (!tokens) return null;
    const needsRefresh =
      tokens.expiresAt - this.opts.autoRefreshSkewMs <= Date.now();
    if (!needsRefresh) return tokens.accessToken;
    try {
      const next = await this.refresh();
      return next.accessToken;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------- sign in
  async signIn(args: {
    scope?: Scope[];
    prompt?: "consent" | "none";
  } = {}): Promise<never> {
    console.log("[lugh][client] signIn entry", performance.now().toFixed(1));
    if (typeof window === "undefined") {
      throw new Error("LughOAuthClient.signIn can only run in the browser");
    }
    console.log("[lugh][client] creating PKCE pair", performance.now().toFixed(1));
    const pair = await createPkcePair();
    console.log("[lugh][client] PKCE pair created", performance.now().toFixed(1));
    const state = createState();
    console.log("[lugh][client] state created", performance.now().toFixed(1));
    savePkceVerifier(pair.verifier);
    saveState(state);
    console.log("[lugh][client] verifier+state saved to sessionStorage", performance.now().toFixed(1));

    const scope =
      args.scope && args.scope.length > 0 ? args.scope : this.opts.scope;
    const url = authorizeUrl({
      apiUrl: this.opts.apiUrl,
      clientId: this.opts.clientId,
      redirectUri: this.opts.redirectUri,
      scope,
      state,
      codeChallenge: pair.challenge,
      language: this.opts.language,
      ...(args.prompt ? { prompt: args.prompt } : {}),
    });
    console.log("[lugh][client] authorize URL built", performance.now().toFixed(1), url);
    console.log("[lugh][client] calling window.location.assign", performance.now().toFixed(1));
    window.location.assign(url);
    console.log("[lugh][client] location.assign returned — navigation scheduled", performance.now().toFixed(1));
    // `location.assign` navigates away; this promise never resolves.
    return new Promise<never>(() => {});
  }

  // --------------------------------------------------------------- callback
  async handleCallback(url?: string): Promise<LughTokens> {
    if (inflightCallback) return inflightCallback;
    inflightCallback = this.doHandleCallback(url).finally(() => {
      inflightCallback = null;
    });
    return inflightCallback;
  }

  private async doHandleCallback(urlStr?: string): Promise<LughTokens> {
    if (typeof window === "undefined" && !urlStr) {
      throw new Error(
        "LughOAuthClient.handleCallback: no URL available (SSR — pass one)",
      );
    }
    const url = new URL(urlStr ?? window.location.href);
    const error = url.searchParams.get("error");
    if (error) {
      const desc = url.searchParams.get("error_description") ?? "";
      if (typeof window !== "undefined") this.cleanUrl(url);
      throw new Error(`${error}: ${desc}`);
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) throw new Error("no authorization code in URL");

    const expectedState = readState();
    if (!expectedState || state !== expectedState) {
      throw new Error("state mismatch — possible CSRF");
    }
    const verifier = readPkceVerifier();
    if (!verifier) throw new Error("missing PKCE verifier");

    // Clear state/verifier before exchange so a reload mid-exchange
    // cannot reuse them. URL is cleaned here too to prevent re-handling.
    clearPkceVerifier();
    clearState();
    if (typeof window !== "undefined") this.cleanUrl(url);

    const tokens = await this.tokenRequest({
      grant_type: "authorization_code",
      client_id: this.opts.clientId,
      code,
      redirect_uri: this.opts.redirectUri,
      code_verifier: verifier,
    });
    this.bus.emit("signin", tokens);
    this.scheduleRefresh();
    return tokens;
  }

  // ----------------------------------------------------------------- refresh
  async refresh(): Promise<LughTokens> {
    if (this.inflightRefresh) return this.inflightRefresh;
    this.inflightRefresh = this.doRefresh().finally(() => {
      this.inflightRefresh = null;
    });
    return this.inflightRefresh;
  }

  private async doRefresh(): Promise<LughTokens> {
    const tokens = await this.getTokens();
    if (!tokens?.refreshToken) throw new Error("no refresh_token available");
    try {
      const next = await this.tokenRequest({
        grant_type: "refresh_token",
        client_id: this.opts.clientId,
        refresh_token: tokens.refreshToken,
      });
      this.bus.emit("refresh", next);
      this.scheduleRefresh();
      return next;
    } catch (err) {
      await this.opts.storage.clear();
      this.cachedTokens = null;
      this.clearRefreshTimer();
      this.bus.emit("signout", undefined);
      throw toError(err);
    }
  }

  // ----------------------------------------------------------------- signOut
  async signOut(): Promise<void> {
    this.clearRefreshTimer();
    const tokens = this.cachedTokens ?? (await this.opts.storage.read());
    if (tokens) {
      const targets: string[] = [];
      if (tokens.refreshToken) targets.push(tokens.refreshToken);
      if (tokens.accessToken) targets.push(tokens.accessToken);
      await Promise.all(
        targets.map((token) =>
          this.opts
            .fetchImpl(revokeUrl(this.opts.apiUrl), {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                token,
                client_id: this.opts.clientId,
              }),
            })
            .catch(() => {
              /* best-effort */
            }),
        ),
      );
    }
    await this.opts.storage.clear();
    this.cachedTokens = null;
    this.bus.emit("signout", undefined);
  }

  // ------------------------------------------------------------------ events
  on<E extends LughAuthEvent>(
    event: E,
    handler: (payload: LughAuthEventPayload[E]) => void,
  ): () => void {
    return this.bus.on(event, handler);
  }

  // --------------------------------------------------------------- helpers
  private async tokenRequest(
    params: Record<string, string>,
  ): Promise<LughTokens> {
    const res = await this.opts.fetchImpl(tokenUrl(this.opts.apiUrl), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`token endpoint ${res.status}: ${detail.slice(0, 200)}`);
    }
    const raw = (await res.json()) as TokenEndpointResponse;
    const scope = raw.scope
      ? (raw.scope.split(/\s+/).filter(Boolean) as Scope[])
      : this.opts.scope;
    const next: LughTokens = {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token ?? "",
      tokenType: "Bearer",
      scope,
      expiresAt: Date.now() + raw.expires_in * 1000,
    };
    if (raw.id_token) next.idToken = raw.id_token;
    await this.opts.storage.write(next);
    this.cachedTokens = next;
    return next;
  }

  private scheduleRefresh(): void {
    this.clearRefreshTimer();
    const tokens = this.cachedTokens;
    if (!tokens?.refreshToken || !tokens.expiresAt) return;
    const delay = tokens.expiresAt - Date.now() - this.opts.autoRefreshSkewMs;
    if (delay <= 0) {
      this.refresh().catch((err) => this.bus.emit("error", toError(err)));
      return;
    }
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch((err) => this.bus.emit("error", toError(err)));
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private cleanUrl(url: URL): void {
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    const search = url.searchParams.toString();
    const next = url.pathname + (search ? `?${search}` : "") + url.hash;
    window.history.replaceState({}, "", next);
  }
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}
