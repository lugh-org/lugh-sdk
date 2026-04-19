export type Scope =
  | "openid"
  | "profile"
  | "email"
  | "credits"
  | "offline_access";

export type LughTokens = {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  tokenType: "Bearer";
  scope: Scope[];
  expiresAt: number;
};

export type LughOAuthOptions = {
  clientId: string;
  redirectUri: string;
  apiUrl: string;
  scope?: Scope[];
  storage?: TokenStorage;
  autoRefreshSkewMs?: number;
  fetchImpl?: typeof fetch;
};

export interface TokenStorage {
  read(): Promise<LughTokens | null>;
  write(tokens: LughTokens): Promise<void>;
  clear(): Promise<void>;
}

export type LughAuthEvent = "signin" | "signout" | "refresh" | "error";

export type LughAuthEventPayload = {
  signin: LughTokens;
  signout: void;
  refresh: LughTokens;
  error: Error;
};
