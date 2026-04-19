import { base64url } from "./pkce.js";

export function createState(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes).slice(0, 32);
}

export function createNonce(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes).slice(0, 24);
}
