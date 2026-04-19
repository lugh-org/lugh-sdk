import { describe, expect, it, vi } from "vitest";
import { LughSso } from "../../../src/oauth/server/sso.js";
import { LughSsoSession } from "../../../src/oauth/server/session.js";
import { InMemoryTokenStore } from "../../../src/oauth/server/token-store.js";
import type { LughTokenSet } from "../../../src/oauth/server/types.js";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeSso(fetchImpl: typeof fetch): LughSso {
  return new LughSso({
    clientId: "my-app",
    redirectUri: "https://partner.example/cb",
    apiUrl: "https://lugh.example",
    fetchImpl,
  });
}

function seed(expiresAt: number): LughTokenSet {
  return {
    accessToken: "at-old",
    refreshToken: "rt-old",
    tokenType: "Bearer",
    scope: ["credits"],
    expiresAt,
    obtainedAt: Date.now(),
  };
}

describe("LughSsoSession", () => {
  it("returns current tokens when not near expiry", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const store = new InMemoryTokenStore();
    await store.save("u_1", seed(Date.now() + 10 * 60 * 1000));

    const session = new LughSsoSession({
      sso: makeSso(fetchImpl),
      store,
      userId: "u_1",
    });
    const tokens = await session.ensureFresh();
    expect(tokens.accessToken).toBe("at-old");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refreshes and persists when close to expiry", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        json({
          access_token: "at-new",
          refresh_token: "rt-new",
          token_type: "Bearer",
          expires_in: 3600,
        }),
    );
    const store = new InMemoryTokenStore();
    await store.save("u_1", seed(Date.now() + 10_000));

    const session = new LughSsoSession({
      sso: makeSso(fetchImpl),
      store,
      userId: "u_1",
    });
    const tokens = await session.ensureFresh();
    expect(tokens.accessToken).toBe("at-new");
    expect(tokens.refreshToken).toBe("rt-new");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const persisted = await store.load("u_1");
    expect(persisted?.accessToken).toBe("at-new");
    expect(persisted?.refreshToken).toBe("rt-new");
  });

  it("carries the old refresh_token forward if the response omits one", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        json({
          access_token: "at-new",
          token_type: "Bearer",
          expires_in: 3600,
        }),
    );
    const store = new InMemoryTokenStore();
    await store.save("u_1", seed(Date.now() + 5_000));

    const session = new LughSsoSession({
      sso: makeSso(fetchImpl),
      store,
      userId: "u_1",
    });
    const tokens = await session.ensureFresh();
    expect(tokens.accessToken).toBe("at-new");
    expect(tokens.refreshToken).toBe("rt-old");
  });

  it("dedups concurrent ensureFresh to a single refresh", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return json({
        access_token: "at-new",
        refresh_token: "rt-new",
        token_type: "Bearer",
        expires_in: 3600,
      });
    });
    const store = new InMemoryTokenStore();
    await store.save("u_1", seed(Date.now() + 5_000));

    const session = new LughSsoSession({
      sso: makeSso(fetchImpl),
      store,
      userId: "u_1",
    });
    await Promise.all([
      session.ensureFresh(),
      session.ensureFresh(),
      session.ensureFresh(),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("clears the store when refresh fails (reuse detection)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("invalid_grant", { status: 400 }),
    );
    const store = new InMemoryTokenStore();
    await store.save("u_1", seed(Date.now() + 5_000));

    const session = new LughSsoSession({
      sso: makeSso(fetchImpl),
      store,
      userId: "u_1",
    });
    await expect(session.ensureFresh()).rejects.toThrow();
    expect(await store.load("u_1")).toBeNull();
  });

  it("throws when no tokens stored", async () => {
    const session = new LughSsoSession({
      sso: makeSso(vi.fn<typeof fetch>()),
      store: new InMemoryTokenStore(),
      userId: "u_1",
    });
    await expect(session.ensureFresh()).rejects.toThrow(/no tokens stored/);
  });
});
