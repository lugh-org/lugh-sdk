# lugh-sdk

SDK unificado da Lugh — OAuth 2.0 / OIDC (browser, server, React) e Credits (API, React) em um único pacote com subpath exports.

## Subpaths

| Import | Ambiente | Uso |
|---|---|---|
| `lugh-sdk/oauth/browser` | Browser | Cliente OAuth + PKCE para SPAs |
| `lugh-sdk/oauth/server`  | Node / Edge | Helpers server-side (SSO, TokenStore, refresh rotation) |
| `lugh-sdk/oauth/react`   | React | `<LughProvider>`, `useLugh`, `useUser`, `SignInButton`, `UserProfile` |
| `lugh-sdk/credits/api`   | Node / Edge | `LughCreditsClient` (consume, refund, cancel) autenticado via `appSecret` |
| `lugh-sdk/credits/react` | React | `useCredits`, `useActions`, `<CreditsBadge>`, `<ConsumeCreditsButton>` |
| `lugh-sdk/styles.css`    | — | CSS dos componentes React |

## Cenários suportados

1. **App com auth próprio** — importa só `credits/react` + `credits/api`, usa scope `credits` no flow OAuth.
2. **Lugh como auth principal** — importa `oauth/react` (ou `oauth/browser`) + opcionalmente `credits/react`.

## Status

Em desenvolvimento inicial. Consumers oficiais: `lugh-test-app`, `lugh-test-api`, `lugh-image-gen`. Substitui `lugh-connect`, `lugh-connect-react` e `lugh-sdk-ts`.
