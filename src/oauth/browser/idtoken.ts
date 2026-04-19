// Decodes JWT claims WITHOUT verifying the signature. Safe only for
// informative display in the browser — server-side validation must use
// JWKS (see `/.well-known/jwks.json` on the Lugh auth server).

export function decodeIdToken<T = Record<string, unknown>>(
  token: string,
): T | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2 || !parts[1]) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "===".slice((b64.length + 3) % 4);
    if (typeof atob === "undefined") return null;
    return JSON.parse(atob(pad)) as T;
  } catch {
    return null;
  }
}
