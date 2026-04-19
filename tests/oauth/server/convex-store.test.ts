import { describe, expect, it, vi } from "vitest";
import { makeFunctionReference } from "convex/server";
import { ConvexTokenStore, type ConvexClientLike } from "../../../src/oauth/server/convex-store.js";
import type { LughTokenSet } from "../../../src/oauth/server/types.js";

function makeTokens(): LughTokenSet {
  return {
    accessToken: "at",
    refreshToken: "rt",
    tokenType: "Bearer",
    scope: ["credits"],
    expiresAt: Date.now() + 3600_000,
    obtainedAt: Date.now(),
  };
}

describe("ConvexTokenStore", () => {
  const api = {
    load: makeFunctionReference<"query">("tokens:load") as never,
    save: makeFunctionReference<"mutation">("tokens:save") as never,
    remove: makeFunctionReference<"mutation">("tokens:remove") as never,
  };

  it("load delegates to convex.query with the right args", async () => {
    const tokens = makeTokens();
    const client: ConvexClientLike = {
      query: vi.fn(async (_ref, args) => {
        expect((args as { userId: string }).userId).toBe("u_1");
        return tokens;
      }) as never,
      mutation: vi.fn() as never,
    };
    const store = new ConvexTokenStore({ client, api });
    const got = await store.load("u_1");
    expect(got).toBe(tokens);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("save delegates to convex.mutation with {userId, tokens}", async () => {
    const tokens = makeTokens();
    const client: ConvexClientLike = {
      query: vi.fn() as never,
      mutation: vi.fn(async (_ref, args) => {
        expect(args).toEqual({ userId: "u_1", tokens });
        return null;
      }) as never,
    };
    const store = new ConvexTokenStore({ client, api });
    await store.save("u_1", tokens);
    expect(client.mutation).toHaveBeenCalledTimes(1);
  });

  it("delete delegates to convex.mutation on the remove ref", async () => {
    const client: ConvexClientLike = {
      query: vi.fn() as never,
      mutation: vi.fn(async (ref, args) => {
        expect(ref).toBe(api.remove);
        expect(args).toEqual({ userId: "u_1" });
        return null;
      }) as never,
    };
    const store = new ConvexTokenStore({ client, api });
    await store.delete("u_1");
    expect(client.mutation).toHaveBeenCalledTimes(1);
  });
});
