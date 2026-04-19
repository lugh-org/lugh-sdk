// PKCE helpers per RFC 7636. S256 only — plain is never emitted.
//
// `createVerifier` returns a high-entropy random string (64 chars,
// URL-safe alphabet). `createChallenge` returns the base64url-encoded
// SHA-256 of the verifier.

const VERIFIER_LENGTH = 64;

export type PkcePair = {
  verifier: string;
  challenge: string;
  method: "S256";
};

export function createVerifier(): string {
  const bytes = new Uint8Array(VERIFIER_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes).slice(0, VERIFIER_LENGTH);
}

export async function createChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(hash));
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = createVerifier();
  const challenge = await createChallenge(verifier);
  return { verifier, challenge, method: "S256" };
}

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
