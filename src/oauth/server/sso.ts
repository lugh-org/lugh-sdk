import type {
  AuthorizationRequest,
  LughIdClaims,
  LughSsoOptions,
  LughTokenSet,
  LughUserinfo,
} from "./types.js";

const DEFAULT_SCOPE = ["openid", "profile", "email", "credits"];
const DEFAULT_REFRESH_SKEW_MS = 60_000;

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type ResolvedOptions = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  apiUrl: string;
  scope: string[];
  refreshSkewMs: number;
  fetchImpl: typeof fetch;
};

export class LughSso {
  private readonly opts: ResolvedOptions;

  constructor(opts: LughSsoOptions) {
    if (!opts?.clientId) throw new Error("LughSso: clientId is required");
    if (!opts?.redirectUri) throw new Error("LughSso: redirectUri is required");
    if (!opts?.apiUrl) throw new Error("LughSso: apiUrl is required");

    this.opts = {
      clientId: opts.clientId,
      ...(opts.clientSecret !== undefined ? { clientSecret: opts.clientSecret } : {}),
      redirectUri: opts.redirectUri,
      apiUrl: opts.apiUrl.replace(/\/+$/, ""),
      scope: opts.scope && opts.scope.length > 0 ? [...opts.scope] : DEFAULT_SCOPE,
      refreshSkewMs: opts.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS,
      fetchImpl: opts.fetchImpl ?? globalThis.fetch.bind(globalThis),
    };
  }

  get clientId(): string {
    return this.opts.clientId;
  }

  get apiUrl(): string {
    return this.opts.apiUrl;
  }

  get redirectUri(): string {
    return this.opts.redirectUri;
  }

  get scope(): string[] {
    return this.opts.scope;
  }

  get refreshSkewMs(): number {
    return this.opts.refreshSkewMs;
  }

  async createAuthorizationRequest(args: {
    scope?: string[];
    state?: string;
    nonce?: string;
  } = {}): Promise<AuthorizationRequest> {
    const codeVerifier = randomString(64);
    const codeChallenge = base64url(await sha256(codeVerifier));
    const state = args.state ?? randomString(32);
    const nonce = args.nonce ?? randomString(24);
    const scope = args.scope && args.scope.length > 0 ? args.scope : this.opts.scope;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.opts.clientId,
      redirect_uri: this.opts.redirectUri,
      scope: scope.join(" "),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return {
      url: `${this.opts.apiUrl}/oauth/continue?${params.toString()}`,
      state,
      nonce,
      codeVerifier,
    };
  }

  async exchangeCode(args: {
    code: string;
    codeVerifier: string;
    redirectUri?: string;
  }): Promise<LughTokenSet> {
    return this.tokenRequest({
      grant_type: "authorization_code",
      client_id: this.opts.clientId,
      code: args.code,
      code_verifier: args.codeVerifier,
      redirect_uri: args.redirectUri ?? this.opts.redirectUri,
    });
  }

  async refresh(refreshToken: string): Promise<LughTokenSet> {
    return this.tokenRequest({
      grant_type: "refresh_token",
      client_id: this.opts.clientId,
      refresh_token: refreshToken,
    });
  }

  async revoke(args: {
    token: string;
    hint?: "access_token" | "refresh_token";
  }): Promise<void> {
    const body = new URLSearchParams({
      token: args.token,
      client_id: this.opts.clientId,
    });
    if (args.hint) body.set("token_type_hint", args.hint);
    const res = await this.opts.fetchImpl(`${this.opts.apiUrl}/api/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`revoke endpoint ${res.status}: ${detail.slice(0, 200)}`);
    }
  }

  async userinfo(accessToken: string): Promise<LughUserinfo> {
    const res = await this.opts.fetchImpl(
      `${this.opts.apiUrl}/api/oauth/userinfo`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`userinfo ${res.status}: ${detail.slice(0, 200)}`);
    }
    return (await res.json()) as LughUserinfo;
  }

  decodeIdToken(idToken: string): LughIdClaims | null {
    try {
      const parts = idToken.split(".");
      if (parts.length < 2 || !parts[1]) return null;
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64 + "===".slice((b64.length + 3) % 4);
      const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
      if (!atobFn) return null;
      return JSON.parse(atobFn(pad)) as LughIdClaims;
    } catch {
      return null;
    }
  }

  private async tokenRequest(
    params: Record<string, string>,
  ): Promise<LughTokenSet> {
    const res = await this.opts.fetchImpl(
      `${this.opts.apiUrl}/api/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`token endpoint ${res.status}: ${detail.slice(0, 200)}`);
    }
    const raw = (await res.json()) as TokenResponse;
    const now = Date.now();
    const scope = raw.scope
      ? raw.scope.split(/\s+/).filter(Boolean)
      : this.opts.scope;
    const next: LughTokenSet = {
      accessToken: raw.access_token,
      tokenType: "Bearer",
      scope,
      expiresAt: now + raw.expires_in * 1000,
      obtainedAt: now,
    };
    if (raw.refresh_token) next.refreshToken = raw.refresh_token;
    if (raw.id_token) next.idToken = raw.id_token;
    return next;
  }
}

// ----------------------------------------------------------------- helpers
function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes).slice(0, len);
}

function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]!);
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(bin)
      : // Bun/Node fallback.
        (globalThis as { Buffer?: { from(s: string, e: string): { toString(x: string): string } } }).Buffer!.from(
          bin,
          "binary",
        ).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", data));
}
