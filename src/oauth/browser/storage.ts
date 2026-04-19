import type { LughTokens, TokenStorage } from "./types.js";

export const STORAGE_KEYS = {
  pkce: "lugh:pkce",
  state: "lugh:state",
  tokens: "lugh:tokens",
} as const;

// SSR-safe: when `window` is missing, every op is a no-op. The provider
// defers usage to `useEffect`, so this only ever runs client-side in
// practice.
export class SessionStorageAdapter implements TokenStorage {
  private get store(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  async read(): Promise<LughTokens | null> {
    const raw = this.store?.getItem(STORAGE_KEYS.tokens);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LughTokens;
    } catch {
      return null;
    }
  }

  async write(tokens: LughTokens): Promise<void> {
    this.store?.setItem(STORAGE_KEYS.tokens, JSON.stringify(tokens));
  }

  async clear(): Promise<void> {
    this.store?.removeItem(STORAGE_KEYS.tokens);
  }
}

// Transient PKCE/state storage — always sessionStorage, not pluggable.
// Callers only need to customize token storage; PKCE verifier lives for
// a single redirect round-trip.
export function savePkceVerifier(verifier: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEYS.pkce, verifier);
}

export function readPkceVerifier(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(STORAGE_KEYS.pkce);
}

export function clearPkceVerifier(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEYS.pkce);
}

export function saveState(state: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEYS.state, state);
}

export function readState(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(STORAGE_KEYS.state);
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEYS.state);
}
