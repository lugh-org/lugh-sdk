import { beforeEach, describe, expect, it, vi } from "vitest";
import { LughOAuthClient } from "../../../src/oauth/browser/client.js";
import { STORAGE_KEYS } from "../../../src/oauth/browser/storage.js";
import type { LughTokens } from "../../../src/oauth/browser/types.js";

function tokenResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function seedTokens(expiresAt: number, refreshToken = "rt"): void {
  const tokens: LughTokens = {
    accessToken: "at-old",
    refreshToken,
    tokenType: "Bearer",
    scope: ["credits"],
    expiresAt,
  };
  window.sessionStorage.setItem(STORAGE_KEYS.tokens, JSON.stringify(tokens));
}

describe("LughOAuthClient.refresh", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("refreshes manually and emits 'refresh'", async () => {
    seedTokens(Date.now() + 1_000_000);

    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("rt");
      return tokenResponse({
        access_token: "at-new",
        refresh_token: "rt-new",
        token_type: "Bearer",
        expires_in: 3600,
      });
    });

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      fetchImpl,
    });

    const refreshed: LughTokens[] = [];
    client.on("refresh", (t) => refreshed.push(t));

    const next = await client.refresh();
    expect(next.accessToken).toBe("at-new");
    expect(next.refreshToken).toBe("rt-new");
    expect(refreshed).toHaveLength(1);
  });

  it("dedups concurrent refresh() calls to a single POST", async () => {
    seedTokens(Date.now() + 1_000_000);

    const fetchImpl = vi.fn<typeof fetch>(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return tokenResponse({
        access_token: "at-new",
        refresh_token: "rt-new",
        token_type: "Bearer",
        expires_in: 3600,
      });
    });

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      fetchImpl,
    });

    await Promise.all([client.refresh(), client.refresh(), client.refresh()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("getAccessToken triggers refresh when within skew", async () => {
    // Token expires in 10s; skew is 60s by default so it is "stale".
    seedTokens(Date.now() + 10_000);

    const fetchImpl = vi.fn<typeof fetch>(async () =>
      tokenResponse({
        access_token: "at-new",
        refresh_token: "rt-new",
        token_type: "Bearer",
        expires_in: 3600,
      }),
    );

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      fetchImpl,
    });

    const token = await client.getAccessToken();
    expect(token).toBe("at-new");
  });

  it("wipes tokens and emits 'signout' when refresh fails", async () => {
    seedTokens(Date.now() + 1_000_000);

    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response("invalid_grant", {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      fetchImpl,
    });

    let signedOut = 0;
    client.on("signout", () => {
      signedOut++;
    });

    await expect(client.refresh()).rejects.toThrow();
    expect(signedOut).toBe(1);
    expect(window.sessionStorage.getItem(STORAGE_KEYS.tokens)).toBeNull();
    expect(client.isSignedIn).toBe(false);
  });
});
