import type { ReactNode } from "react";
import type { LughOAuthClient } from "../browser/client.js";
import type { LughEnvironment, Scope } from "../browser/types.js";
import type { Language } from "./i18n.js";

export type Theme = "light" | "dark" | "system";

export type LughUserClaims = {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  iss?: string;
  exp?: number;
  [key: string]: unknown;
};

export type LughProviderProps = {
  clientId: string;
  redirectUri: string;
  apiUrl: string;
  cloudUrl?: string;
  scope?: Scope[];
  // Declara o ambiente que o app está rodando. Vai como query param no
  // `/oauth/continue` e é a única fonte de verdade pra os hooks de
  // credits (useCredits, useConsumeCredits, LughConsumeCreditsButton).
  // Default: "production".
  //   - "production" — exige app aprovado pela equipe Lugh
  //   - "sandbox"    — só o próprio developer do app consegue autorizar
  environment?: LughEnvironment;
  theme?: Theme;
  language?: Language;
  primaryColor?: string;
  children: ReactNode;
  onError?: (err: Error) => void;
};

export type LughContextValue = {
  client: LughOAuthClient | null;
  isSignedIn: boolean;
  loading: boolean;
  error: Error | null;
  user: LughUserClaims | null;
  accessToken: string | null;
  apiUrl: string;
  clientId: string;
  fetchAccessToken: (args?: {
    forceRefreshToken?: boolean;
  }) => Promise<string | null>;
  signIn: (args?: { scope?: Scope[] }) => Promise<void>;
  signOut: () => Promise<void>;
  language: Language;
  theme: Theme;
};

export type { Language, Scope };
