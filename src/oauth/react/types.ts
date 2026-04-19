import type { ReactNode } from "react";
import type { LughOAuthClient } from "../browser/client.js";
import type { Scope } from "../browser/types.js";
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
  scope?: Scope[];
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
