import type { Language } from "./language.js";
import type { Scope } from "./types.js";

export function authorizeUrl(args: {
  apiUrl: string;
  clientId: string;
  redirectUri: string;
  scope: Scope[];
  state: string;
  codeChallenge: string;
  prompt?: "consent" | "none";
  nonce?: string;
  language?: Language;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    scope: args.scope.join(" "),
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: "S256",
  });
  if (args.prompt) params.set("prompt", args.prompt);
  if (args.nonce) params.set("nonce", args.nonce);
  return `${args.apiUrl}/${args.language}/oauth/continue?${params.toString()}`;
}

export function tokenUrl(apiUrl: string): string {
  return `${apiUrl}/api/oauth/token`;
}

export function revokeUrl(apiUrl: string): string {
  return `${apiUrl}/api/oauth/revoke`;
}

export function userinfoUrl(apiUrl: string): string {
  return `${apiUrl}/api/oauth/userinfo`;
}
