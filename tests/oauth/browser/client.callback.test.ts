import { beforeEach, describe, expect, it, vi } from "vitest";
import { LughOAuthClient } from "../../../src/oauth/browser/client.js";
import { STORAGE_KEYS } from "../../../src/oauth/browser/storage.js";

function tokenResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LughOAuthClient.handleCallback", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("exchanges code for tokens when state+verifier match", async () => {
    window.sessionStorage.setItem(STORAGE_KEYS.state, "S123");
    window.sessionStorage.setItem(STORAGE_KEYS.pkce, "V-verifier");
    window.history.replaceState({}, "", "/?code=abc&state=S123");

    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("abc");
      expect(body.get("code_verifier")).toBe("V-verifier");
      expect(body.get("client_id")).toBe("my-app");
      expect(body.get("redirect_uri")).toBe("https://partner.example/callback");
      return tokenResponse({
        access_token: "at",
        refresh_token: "rt",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "credits",
      });
    });

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      scope: ["credits"],
      fetchImpl,
    });

    expect(client.isSignedIn).toBe(true);
    const tokens = await client.getTokens();
    expect(tokens?.accessToken).toBe("at");
    expect(tokens?.refreshToken).toBe("rt");
    expect(tokens?.scope).toEqual(["credits"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // URL must be cleaned (no code/state).
    expect(window.location.search).toBe("");
    // Single-use PKCE/state cleared.
    expect(window.sessionStorage.getItem(STORAGE_KEYS.state)).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEYS.pkce)).toBeNull();
  });

  it("rejects on state mismatch", async () => {
    window.sessionStorage.setItem(STORAGE_KEYS.state, "EXPECTED");
    window.sessionStorage.setItem(STORAGE_KEYS.pkce, "V");
    window.history.replaceState({}, "", "/?code=abc&state=WRONG");

    const fetchImpl = vi.fn<typeof fetch>();
    const errors: Error[] = [];

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      fetchImpl,
    });
    client.on("error", (err) => errors.push(err));

    expect(client.isSignedIn).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("propagates explicit error= param", async () => {
    window.sessionStorage.setItem(STORAGE_KEYS.state, "S");
    window.sessionStorage.setItem(STORAGE_KEYS.pkce, "V");
    window.history.replaceState(
      {},
      "",
      "/?error=access_denied&error_description=user+cancelled",
    );

    const fetchImpl = vi.fn<typeof fetch>();
    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      fetchImpl,
    });

    expect(client.isSignedIn).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    // URL is cleaned even on error.
    expect(window.location.search).toBe("");
  });
});
