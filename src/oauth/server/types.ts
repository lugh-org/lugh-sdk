export type LughTokenSet = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: "Bearer";
  scope: string[];
  expiresAt: number;
  obtainedAt: number;
};

export type LughUserinfo = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string | null;
  [key: string]: unknown;
};

export type LughIdClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string | null;
  [key: string]: unknown;
};

export interface TokenStore {
  load(userId: string): Promise<LughTokenSet | null>;
  save(userId: string, tokens: LughTokenSet): Promise<void>;
  delete(userId: string): Promise<void>;
}

export type LughSsoOptions = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  apiUrl: string;
  scope?: string[];
  refreshSkewMs?: number;
  fetchImpl?: typeof fetch;
};

export type AuthorizationRequest = {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
};

export type CookieAdapter = {
  read(req: Request, name: string): string | null;
  build(args: {
    name: string;
    value: string;
    maxAgeSeconds: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  }): string;
};
