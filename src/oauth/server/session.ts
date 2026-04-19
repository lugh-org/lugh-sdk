import type { LughSso } from "./sso.js";
import type { LughTokenSet, TokenStore } from "./types.js";

export type LughSsoSessionOptions = {
  sso: LughSso;
  store: TokenStore;
  userId: string;
  refreshSkewMs?: number;
};

// Composes `LughSso` + `TokenStore` for a single user. `ensureFresh`
// returns the persisted token set, rotating via refresh_token when the
// access is close to (or past) expiry. Concurrent calls share one
// rotation — preventing refresh_token reuse detection from invalidating
// the whole family.
export class LughSsoSession {
  private readonly sso: LughSso;
  private readonly store: TokenStore;
  private readonly userId: string;
  private readonly refreshSkewMs: number;
  private inflight: Promise<LughTokenSet> | null = null;

  constructor(opts: LughSsoSessionOptions) {
    this.sso = opts.sso;
    this.store = opts.store;
    this.userId = opts.userId;
    this.refreshSkewMs = opts.refreshSkewMs ?? opts.sso.refreshSkewMs;
  }

  async load(): Promise<LughTokenSet | null> {
    return this.store.load(this.userId);
  }

  async save(tokens: LughTokenSet): Promise<void> {
    await this.store.save(this.userId, tokens);
  }

  async ensureFresh(): Promise<LughTokenSet> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doEnsureFresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async getAccessToken(): Promise<string> {
    const tokens = await this.ensureFresh();
    return tokens.accessToken;
  }

  async signOut(): Promise<void> {
    const current = await this.store.load(this.userId);
    await this.store.delete(this.userId);
    if (!current?.refreshToken) return;
    try {
      await this.sso.revoke({
        token: current.refreshToken,
        hint: "refresh_token",
      });
    } catch {
      // best-effort
    }
  }

  private async doEnsureFresh(): Promise<LughTokenSet> {
    const current = await this.store.load(this.userId);
    if (!current) {
      throw new Error(
        `LughSsoSession: no tokens stored for user ${this.userId}`,
      );
    }
    if (!this.needsRefresh(current)) return current;
    if (!current.refreshToken) {
      throw new Error(
        `LughSsoSession: token expired and no refresh_token for user ${this.userId}`,
      );
    }

    let refreshed: LughTokenSet;
    try {
      refreshed = await this.sso.refresh(current.refreshToken);
    } catch (err) {
      // `invalid_grant` includes reuse-detection: the refresh_token we
      // have is now invalid, so clear the store to force re-login.
      await this.store.delete(this.userId).catch(() => {});
      throw err;
    }

    // Some grants omit a new refresh_token; carry the old one forward.
    const next: LughTokenSet = { ...refreshed };
    const carryRefresh = refreshed.refreshToken ?? current.refreshToken;
    if (carryRefresh) next.refreshToken = carryRefresh;
    await this.store.save(this.userId, next);
    return next;
  }

  private needsRefresh(tokens: LughTokenSet): boolean {
    if (!tokens.expiresAt) return false;
    return tokens.expiresAt - this.refreshSkewMs <= Date.now();
  }
}
