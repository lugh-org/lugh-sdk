import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LughOAuthClient } from "../../../src/oauth/browser/client.js";
import { STORAGE_KEYS } from "../../../src/oauth/browser/storage.js";

const originalLocation = window.location;

function stubLocation(assign: (url: string) => void): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      href: "https://partner.example/",
      pathname: "/",
      search: "",
      origin: "https://partner.example",
      assign,
      replace: (): void => {},
    },
  });
}

async function waitUntilCalled(
  mock: { mock: { calls: unknown[][] } },
  timeoutMs = 500,
): Promise<void> {
  const start = Date.now();
  while (mock.mock.calls.length === 0) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("assign was not called within timeout");
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("LughOAuthClient.signIn", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it("builds the authorize URL with PKCE+state and navigates", async () => {
    const assign = vi.fn();
    stubLocation(assign);

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      scope: ["credits"],
      language: "pt",
    });

    // signIn returns a never-resolving Promise after location.assign.
    // Fire it, then actively wait for the assign side-effect.
    void client.signIn().catch(() => {});
    await waitUntilCalled(assign);

    expect(assign).toHaveBeenCalledTimes(1);
    const url = new URL(assign.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe(
      "https://lugh.example/oauth/continue",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("my-app");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://partner.example/callback",
    );
    expect(url.searchParams.get("scope")).toBe("credits");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    const state = window.sessionStorage.getItem(STORAGE_KEYS.state);
    const verifier = window.sessionStorage.getItem(STORAGE_KEYS.pkce);
    expect(state).toBeTruthy();
    expect(verifier).toBeTruthy();
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });

  it("accepts a scope override on signIn()", async () => {
    const assign = vi.fn();
    stubLocation(assign);

    const client = await LughOAuthClient.init({
      clientId: "my-app",
      redirectUri: "https://partner.example/callback",
      apiUrl: "https://lugh.example",
      scope: ["credits"],
    });

    void client
      .signIn({ scope: ["openid", "profile", "email", "credits"] })
      .catch(() => {});
    await waitUntilCalled(assign);

    const url = new URL(assign.mock.calls[0]![0] as string);
    expect(url.searchParams.get("scope")).toBe(
      "openid profile email credits",
    );
  });
});
