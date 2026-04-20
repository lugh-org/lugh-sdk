import { describe, expect, it, vi } from "vitest";
import { LughSso } from "../../../src/oauth/server/sso.js";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LughSso", () => {
  const baseOpts = {
    clientId: "my-app",
    redirectUri: "https://partner.example/cb",
    apiUrl: "https://lugh.example",
  };

  it("trims trailing slashes from apiUrl", () => {
    const sso = new LughSso({ ...baseOpts, apiUrl: "https://lugh.example///" });
    expect(sso.apiUrl).toBe("https://lugh.example");
  });

  it("createAuthorizationRequest builds a valid URL with PKCE+state", async () => {
    const sso = new LughSso({ ...baseOpts });
    const req = await sso.createAuthorizationRequest({
      scope: ["openid", "credits"],
    });
    const url = new URL(req.url);
    expect(url.origin + url.pathname).toBe(
      "https://lugh.example/oauth/continue",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("my-app");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://partner.example/cb",
    );
    expect(url.searchParams.get("scope")).toBe("openid credits");
    expect(url.searchParams.get("state")).toBe(req.state);
    expect(url.searchParams.get("nonce")).toBe(req.nonce);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(req.codeVerifier.length).toBe(64);
  });

  it("exchangeCode POSTs the right form and normalizes the response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("CODE");
      expect(body.get("code_verifier")).toBe("VER");
      expect(body.get("client_id")).toBe("my-app");
      expect(body.get("redirect_uri")).toBe("https://partner.example/cb");
      return json({
        access_token: "at",
        refresh_token: "rt",
        id_token: "idt",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid credits",
      });
    });
    const sso = new LughSso({ ...baseOpts, fetchImpl });
    const tokens = await sso.exchangeCode({
      code: "CODE",
      codeVerifier: "VER",
    });
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.idToken).toBe("idt");
    expect(tokens.scope).toEqual(["openid", "credits"]);
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it("refresh POSTs grant_type=refresh_token", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("grant_type")).toBe("refresh_token");
      expect(body.get("refresh_token")).toBe("RT");
      return json({
        access_token: "at2",
        refresh_token: "rt2",
        token_type: "Bearer",
        expires_in: 3600,
      });
    });
    const sso = new LughSso({ ...baseOpts, fetchImpl });
    const tokens = await sso.refresh("RT");
    expect(tokens.accessToken).toBe("at2");
    expect(tokens.refreshToken).toBe("rt2");
  });

  it("revoke posts to /api/oauth/revoke", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe("https://lugh.example/api/oauth/revoke");
      const body = init?.body as URLSearchParams;
      expect(body.get("token")).toBe("TKN");
      expect(body.get("token_type_hint")).toBe("refresh_token");
      return new Response("", { status: 200 });
    });
    const sso = new LughSso({ ...baseOpts, fetchImpl });
    await sso.revoke({ token: "TKN", hint: "refresh_token" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("userinfo sends Bearer token", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer AT",
      );
      return json({ sub: "u_1", email: "a@b.c" });
    });
    const sso = new LughSso({ ...baseOpts, fetchImpl });
    const info = await sso.userinfo("AT");
    expect(info.sub).toBe("u_1");
  });

  it("throws on non-2xx token response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("oops", { status: 400 }),
    );
    const sso = new LughSso({ ...baseOpts, fetchImpl });
    await expect(sso.refresh("RT")).rejects.toThrow(/token endpoint 400/);
  });
});
