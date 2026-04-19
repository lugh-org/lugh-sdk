import { describe, expect, it } from "vitest";
import { createChallenge, createPkcePair, createVerifier } from "../../../src/oauth/browser/pkce.js";

const B64URL_ALPHABET = /^[A-Za-z0-9_-]+$/;

describe("pkce", () => {
  it("createVerifier produces a 64-char URL-safe string", () => {
    const v = createVerifier();
    expect(v.length).toBe(64);
    expect(B64URL_ALPHABET.test(v)).toBe(true);
  });

  it("createVerifier returns distinct values across calls", () => {
    const a = createVerifier();
    const b = createVerifier();
    expect(a).not.toBe(b);
  });

  it("createChallenge returns the base64url SHA-256 of the verifier", async () => {
    // RFC 7636 test vector.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    const challenge = await createChallenge(verifier);
    expect(challenge).toBe(expected);
  });

  it("createPkcePair returns consistent verifier+challenge", async () => {
    const pair = await createPkcePair();
    expect(pair.method).toBe("S256");
    expect(pair.verifier.length).toBe(64);
    const challenge = await createChallenge(pair.verifier);
    expect(pair.challenge).toBe(challenge);
  });
});
