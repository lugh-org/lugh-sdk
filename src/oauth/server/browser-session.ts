import { LughSsoSession } from "./session.js";
import type { LughSso } from "./sso.js";
import type { CookieAdapter, TokenStore } from "./types.js";

// Server-side BFF helper. Holds the refresh_token on the partner
// backend (in `TokenStore`) and hands the browser short-lived access
// tokens via a session cookie that just carries the user id.
//
// Wire three routes in the partner backend:
//   GET  /api/oauth/callback  -> handleCallback(req)
//   GET  /api/oauth/me        -> getAccessToken(req)
//   POST /api/oauth/logout    -> signOut(req)
//
// State + PKCE verifier live in short-lived cookies (set at the same
// time as the /authorize redirect). Implementers are expected to sign
// those cookies or keep them HttpOnly+Secure.

export type LughBrowserSessionOptions = {
  sso: LughSso;
  store: TokenStore;
  cookie: CookieAdapter;
  /** Cookie name holding the authenticated user id. Default: `lugh_session`. */
  sessionCookieName?: string;
  /** Session cookie max age (seconds). Default: 30 days. */
  sessionMaxAgeSeconds?: number;
  /** Cookie name holding the PKCE verifier. Default: `lugh_pkce`. */
  pkceCookieName?: string;
  /** Cookie name holding the CSRF state. Default: `lugh_state`. */
  stateCookieName?: string;
  /**
   * Extract the user id from an authenticated token set. Default:
   * decode the id_token and return `sub`.
   */
  resolveUserId?: (args: {
    tokens: ReturnType<LughSso["decodeIdToken"]> extends null
      ? never
      : unknown;
  }) => string | null;
};

export class LughBrowserSession {
  private readonly sso: LughSso;
  private readonly store: TokenStore;
  private readonly cookie: CookieAdapter;
  private readonly sessionName: string;
  private readonly sessionMaxAge: number;
  private readonly pkceName: string;
  private readonly stateName: string;

  constructor(opts: LughBrowserSessionOptions) {
    this.sso = opts.sso;
    this.store = opts.store;
    this.cookie = opts.cookie;
    this.sessionName = opts.sessionCookieName ?? "lugh_session";
    this.sessionMaxAge = opts.sessionMaxAgeSeconds ?? 30 * 24 * 60 * 60;
    this.pkceName = opts.pkceCookieName ?? "lugh_pkce";
    this.stateName = opts.stateCookieName ?? "lugh_state";
  }

  // -- redirect to /authorize ------------------------------------------
  async startSignIn(args: {
    scope?: string[];
    redirectPath?: string;
  } = {}): Promise<Response> {
    const req = await this.sso.createAuthorizationRequest(
      args.scope ? { scope: args.scope } : {},
    );
    const headers = new Headers();
    headers.append("Location", req.url);
    headers.append(
      "Set-Cookie",
      this.cookie.build({
        name: this.pkceName,
        value: req.codeVerifier,
        maxAgeSeconds: 600,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      }),
    );
    headers.append(
      "Set-Cookie",
      this.cookie.build({
        name: this.stateName,
        value: req.state,
        maxAgeSeconds: 600,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      }),
    );
    return new Response(null, { status: 302, headers });
  }

  // -- handle /callback?code=...&state=... -----------------------------
  async handleCallback(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) throw new Error("missing authorization code");

    const expectedState = this.cookie.read(req, this.stateName);
    if (!expectedState || state !== expectedState) {
      throw new Error("state mismatch — possible CSRF");
    }
    const verifier = this.cookie.read(req, this.pkceName);
    if (!verifier) throw new Error("missing PKCE verifier");

    const tokens = await this.sso.exchangeCode({
      code,
      codeVerifier: verifier,
    });

    const claims = tokens.idToken ? this.sso.decodeIdToken(tokens.idToken) : null;
    const userId = claims?.sub;
    if (!userId) {
      throw new Error(
        "callback: id_token missing `sub` — cannot key session",
      );
    }
    await this.store.save(userId, tokens);

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      this.cookie.build({
        name: this.sessionName,
        value: userId,
        maxAgeSeconds: this.sessionMaxAge,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      }),
    );
    // Clear short-lived state/pkce.
    headers.append(
      "Set-Cookie",
      this.cookie.build({
        name: this.pkceName,
        value: "",
        maxAgeSeconds: 0,
      }),
    );
    headers.append(
      "Set-Cookie",
      this.cookie.build({
        name: this.stateName,
        value: "",
        maxAgeSeconds: 0,
      }),
    );
    return new Response(
      JSON.stringify({ signedIn: true, userId }),
      {
        status: 200,
        headers: mergeHeaders(headers, {
          "Content-Type": "application/json",
        }),
      },
    );
  }

  async getAccessToken(req: Request): Promise<string | null> {
    const userId = this.cookie.read(req, this.sessionName);
    if (!userId) return null;
    const session = new LughSsoSession({ sso: this.sso, store: this.store, userId });
    try {
      return await session.getAccessToken();
    } catch {
      return null;
    }
  }

  async signOut(req: Request): Promise<Response> {
    const userId = this.cookie.read(req, this.sessionName);
    if (userId) {
      const session = new LughSsoSession({ sso: this.sso, store: this.store, userId });
      await session.signOut();
    }
    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      this.cookie.build({
        name: this.sessionName,
        value: "",
        maxAgeSeconds: 0,
      }),
    );
    return new Response(JSON.stringify({ signedIn: false }), {
      status: 200,
      headers: mergeHeaders(headers, { "Content-Type": "application/json" }),
    });
  }
}

function mergeHeaders(base: Headers, extra: Record<string, string>): Headers {
  for (const [k, v] of Object.entries(extra)) base.append(k, v);
  return base;
}
