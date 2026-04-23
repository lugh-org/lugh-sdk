import type { Language } from "./language.js";

export type Scope =
  | "openid"
  | "profile"
  | "email"
  | "credits"
  | "offline_access";

// Ambiente de execução declarado pelo app no `LughProvider`. Vai como
// query param no `/oauth/continue` e é validado server-side:
//   - "sandbox"    — só o próprio dev do app pode autorizar (self-test
//                     enquanto o app aguarda approval)
//   - "production" — exige `approvalStatus === "approved"` no app
export type LughEnvironment = "production" | "sandbox";

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
  language?: Language;
  // Ambiente em que o app está rodando. Propagado como query param no
  // fluxo de authorize pra o Lugh validar o contexto.
  environment?: LughEnvironment;
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
