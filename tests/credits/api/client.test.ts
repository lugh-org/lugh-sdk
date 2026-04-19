import { beforeEach, describe, expect, it, vi } from "vitest";
import { LughCreditsClient } from "../../../src/credits/api/client.js";

// Mock the Convex HTTP client so tests don't touch the network.
const mutationSpy = vi.fn();
const querySpy = vi.fn();

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    constructor(public readonly url: string) {}
    mutation(ref: unknown, args: unknown): unknown {
      return mutationSpy(ref, args);
    }
    query(ref: unknown, args: unknown): unknown {
      return querySpy(ref, args);
    }
  },
}));

describe("LughCreditsClient", () => {
  beforeEach(() => {
    mutationSpy.mockReset();
    querySpy.mockReset();
  });

  it("throws without required options", () => {
    expect(
      () =>
        new LughCreditsClient({
          cloudUrl: "",
          appSecret: "s",
          appSlug: "a",
        }),
    ).toThrow(/cloudUrl/);
    expect(
      () =>
        new LughCreditsClient({
          cloudUrl: "u",
          appSecret: "",
          appSlug: "a",
        }),
    ).toThrow(/appSecret/);
    expect(
      () =>
        new LughCreditsClient({
          cloudUrl: "u",
          appSecret: "s",
          appSlug: "",
        }),
    ).toThrow(/appSlug/);
  });

  it("consumeCreditRequest posts expected payload", async () => {
    mutationSpy.mockResolvedValueOnce({
      success: true,
      creditsCharged: 5,
      requestId: "r1",
    });
    const client = new LughCreditsClient({
      cloudUrl: "https://example.convex.cloud",
      appSecret: "SECRET",
      appSlug: "my-app",
    });

    const res = await client.consumeCreditRequest({
      userId: "u1",
      requestId: "r1",
      expectedActionSlug: "summarize",
    });

    expect(res).toEqual({
      success: true,
      creditsCharged: 5,
      requestId: "r1",
    });
    expect(mutationSpy).toHaveBeenCalledTimes(1);
    const [, args] = mutationSpy.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(args).toEqual({
      appSecret: "SECRET",
      appSlug: "my-app",
      userId: "u1",
      requestId: "r1",
      expectedActionSlug: "summarize",
    });
  });

  it("refundCreditRequest includes reason", async () => {
    mutationSpy.mockResolvedValueOnce({ success: true });
    const client = new LughCreditsClient({
      cloudUrl: "u",
      appSecret: "S",
      appSlug: "a",
    });
    await client.refundCreditRequest({
      userId: "u1",
      requestId: "r1",
      reason: "user error",
    });
    const [, args] = mutationSpy.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(args).toEqual({
      appSecret: "S",
      appSlug: "a",
      userId: "u1",
      requestId: "r1",
      reason: "user error",
    });
  });

  it("cancelCreditRequest sends cancel args", async () => {
    mutationSpy.mockResolvedValueOnce({ success: true });
    const client = new LughCreditsClient({
      cloudUrl: "u",
      appSecret: "S",
      appSlug: "a",
    });
    await client.cancelCreditRequest({ userId: "u1", requestId: "r1" });
    const [, args] = mutationSpy.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(args).toEqual({
      appSecret: "S",
      appSlug: "a",
      userId: "u1",
      requestId: "r1",
    });
  });

  it("getCreditRequest delegates to query", async () => {
    querySpy.mockResolvedValueOnce(null);
    const client = new LughCreditsClient({
      cloudUrl: "u",
      appSecret: "S",
      appSlug: "a",
    });
    const res = await client.getCreditRequest({
      userId: "u1",
      requestId: "r1",
    });
    expect(res).toBeNull();
    const [, args] = querySpy.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(args).toEqual({
      appSecret: "S",
      appSlug: "a",
      userId: "u1",
      requestId: "r1",
    });
  });

  it("propagates Convex errors", async () => {
    mutationSpy.mockRejectedValueOnce(new Error("invalid appSecret"));
    const client = new LughCreditsClient({
      cloudUrl: "u",
      appSecret: "BAD",
      appSlug: "a",
    });
    await expect(
      client.consumeCreditRequest({
        userId: "u1",
        requestId: "r1",
        expectedActionSlug: "x",
      }),
    ).rejects.toThrow(/invalid appSecret/);
  });
});
