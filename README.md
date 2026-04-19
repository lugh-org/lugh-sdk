# lugh-sdk

Unified SDK for integrating with [Lugh](https://lugh.digital) — OAuth 2.0 / OIDC authentication and Credits billing in a single package with subpath exports.

## Installation

```bash
npm install lugh-sdk
```

Peer dependencies (install only what you use):

```bash
# React components
npm install react

# Credits hooks (Convex-powered real-time queries)
npm install convex
```

## Quick start

### 1. Wrap your app with `LughProvider`

```tsx
import { LughProvider } from "lugh-sdk/oauth/react";
import "lugh-sdk/styles.css";

export default function App({ children }) {
  return (
    <LughProvider
      clientId="your-app-slug"
      redirectUri="http://localhost:3000"
      apiUrl="https://app.lugh.digital"
      cloudUrl="https://your-convex-url.convex.cloud" // optional, enables credits hooks
    >
      {children}
    </LughProvider>
  );
}
```

### 2. Add sign-in

```tsx
import { LughSignInButton } from "lugh-sdk/oauth/react";

function LoginPage() {
  return <LughSignInButton />;
}
```

### 3. Consume credits

```tsx
import { LughConsumeCreditsButton } from "lugh-sdk/credits/react";

function GenerateButton() {
  return (
    <LughConsumeCreditsButton
      actionSlug="generate-image"
      onSuccess={(ctx) => {
        // ctx.requestId — confirm this on your server
        fetch("/api/generate", {
          method: "POST",
          body: JSON.stringify({ requestId: ctx.requestId }),
        });
      }}
      onError={(err) => console.error(err)}
    >
      {(cost) => <>Generate ({cost} credits)</>}
    </LughConsumeCreditsButton>
  );
}
```

### 4. Confirm on your server

```ts
import { LughCreditsClient } from "lugh-sdk/credits/api";

const lugh = new LughCreditsClient({
  cloudUrl: process.env.LUGH_CLOUD_URL!,
  appSecret: process.env.LUGH_APP_SECRET!, // never expose this client-side
  appSlug: "your-app-slug",
});

// After your action succeeds, confirm the charge:
const result = await lugh.consumeCreditRequest({
  userId: sub, // from the access token `sub` claim
  requestId: body.requestId,
  expectedActionSlug: "generate-image",
});

// If the action fails, release the reserved credits:
await lugh.cancelCreditRequest({
  userId: sub,
  requestId: body.requestId,
});
```

## Subpath exports

| Import | Environment | Purpose |
|---|---|---|
| `lugh-sdk/oauth/browser` | Browser | Low-level OAuth client with PKCE for SPAs |
| `lugh-sdk/oauth/server` | Node / Edge | SSO, token management, session helpers |
| `lugh-sdk/oauth/react` | React | `<LughProvider>`, hooks, UI components |
| `lugh-sdk/credits/api` | Node / Edge | Server-side credits client (`appSecret` auth) |
| `lugh-sdk/credits/react` | React | Credits hooks and UI components |
| `lugh-sdk/styles.css` | Any | CSS for all React components |

## Integration scenarios

### A) Lugh as your auth provider

Use the full OAuth + Credits stack. Users sign in through Lugh, and you bill with credits.

```
lugh-sdk/oauth/react  +  lugh-sdk/credits/react  +  lugh-sdk/credits/api
```

### B) Your own auth, Lugh for billing only

Your app has its own auth (Clerk, Auth0, etc.). You redirect users to Lugh only to authorize credit usage (scope `credits`), then manage billing server-side.

```
lugh-sdk/credits/react  +  lugh-sdk/credits/api
```

### C) Server-side SSO (Next.js, Express, etc.)

For server-rendered apps that need Lugh identity on the backend.

```
lugh-sdk/oauth/server
```

---

## API reference

### `lugh-sdk/oauth/react`

#### `<LughProvider>`

Root context provider. Must wrap all Lugh components and hooks.

```tsx
<LughProvider
  clientId="your-app-slug"        // required — your app's slug on Lugh
  redirectUri="https://..."       // required — OAuth callback URL
  apiUrl="https://app.lugh.digital" // required — Lugh API base URL
  cloudUrl="https://...convex.cloud" // optional — enables real-time credit queries
  scope={["credits"]}             // optional — defaults to ["credits"]
  theme="system"                  // optional — "light" | "dark" | "system"
  language="en"                   // optional — "en" | "pt" | ...
  primaryColor="#6366f1"          // optional — CSS custom property override
  onError={(err) => {}}           // optional — global error handler
>
  {children}
</LughProvider>
```

#### `useLugh()`

Access the auth context. Must be used within `<LughProvider>`.

```tsx
const {
  isSignedIn,    // boolean
  loading,       // boolean — true while initializing
  error,         // Error | null
  user,          // LughUserClaims | null — decoded token claims
  accessToken,   // string | null
  signIn,        // (args?: { scope?: Scope[] }) => Promise<void>
  signOut,       // () => Promise<void>
  fetchAccessToken, // (args?: { forceRefreshToken?: boolean }) => Promise<string | null>
  client,        // LughOAuthClient | null — low-level client
  apiUrl,        // string
  clientId,      // string
  language,      // Language
  theme,         // Theme
} = useLugh();
```

#### `useUser()`

Returns enriched user profile with parsed name fields. Fetches `/userinfo` when signed in.

```tsx
const user = useUser();
// user.sub         — Lugh user ID
// user.email       — string | null
// user.name        — string | null
// user.displayName — string | null (first name or full name)
// user.initials    — string (e.g. "AP")
// user.picture     — string | null (avatar URL)
// user.raw         — full LughUserClaims object
```

#### `<LughSignInButton>`

Pre-styled button that triggers the OAuth flow.

```tsx
<LughSignInButton
  className="my-class"        // optional — appended to default classes
  classOverride="custom-btn"  // optional — replaces default class entirely
  showIcon={true}             // optional — show Lugh icon (default: true)
  onClick={() => {}}          // optional — called before sign-in starts
  onError={(err) => {}}       // optional
>
  Custom label                {/* optional — default: "Sign in with Lugh" */}
</LughSignInButton>
```

#### `<LughUserProfile>`

Displays the signed-in user's avatar with a sign-out dropdown.

```tsx
<LughUserProfile
  size={32}                   // optional — avatar size in px
  className="my-class"        // optional
  hideSignOut={false}         // optional
  signOutLabel="Log out"      // optional
  onSignOut={() => {}}        // optional — called after sign-out
  onError={(err) => {}}       // optional
>
  {(user) => <span>{user.displayName}</span>}  {/* optional render function */}
</LughUserProfile>
```

---

### `lugh-sdk/credits/react`

All hooks require `<LughProvider>` with `cloudUrl` set.

#### `useCredits(opts?)`

Real-time credit balance subscription.

```tsx
const { balance, breakdown, loading, error } = useCredits({
  environment: "production", // optional — "production" | "sandbox"
  appSlug: "your-app-slug",  // optional — defaults to clientId
});

// balance.total      — total credits available
// balance.reserved   — credits reserved by pending requests
// balance.available  — total - reserved

// breakdown.blocks   — individual credit blocks with expiry
// breakdown.subscription — credits from active plan
// breakdown.packs    — credits from one-time packs
// breakdown.sandbox  — sandbox credits (developers only)
```

#### `useActions(appSlug)`

Fetches the action catalog (prices) for an app.

```tsx
const { actions, loading, bySlug } = useActions("your-app-slug");

// actions — LughAppAction[] with { slug, name, amount }
// bySlug("generate-image") — find a specific action or null
```

#### `useConsumeCredits()`

Returns a function that opens a credit request (reserves credits).

```tsx
const createConsumeRequest = useConsumeCredits();

const result = await createConsumeRequest({
  appSlug: "your-app-slug",     // optional — defaults to clientId
  actionSlug: "generate-image", // required — must match a registered action
  environment: "production",    // optional
  idempotencyKey: "unique-key", // optional — prevents duplicate charges
});

// result.requestId      — pass this to your server for confirmation
// result.expiresAt      — reservation expiry (6 hours)
// result.creditsReserved — amount reserved
```

#### `<LughConsumeCreditsButton>`

All-in-one button that checks balance, reserves credits, and calls your handler.

```tsx
<LughConsumeCreditsButton
  actionSlug="generate-image"     // required
  appSlug="your-app-slug"         // optional — defaults to clientId
  environment="production"        // optional
  idempotencyKey="unique-key"     // optional
  upgradeUrl="/pricing"           // optional — shown when balance is insufficient
  disabled={false}                // optional
  loadingLabel="Processing..."    // optional
  className="my-class"            // optional
  classOverride="custom-btn"      // optional
  onClick={async (ctx) => {       // optional — called after credits are reserved
    await fetch("/api/run", {
      method: "POST",
      body: JSON.stringify({ requestId: ctx.requestId }),
    });
  }}
  onSuccess={(ctx) => {}}         // optional — called after onClick resolves
  onError={(err) => {}}           // optional
>
  {/* Option A: static label */}
  Generate image

  {/* Option B: render function with cost */}
  {(cost) => <>Generate ({cost} credits)</>}
</LughConsumeCreditsButton>
```

The button automatically:
- Disables when balance is insufficient, actions are loading, or user is not signed in
- Shows an "insufficient credits" message with an upgrade link
- Handles loading states

**Error classes** thrown via `onError`:
- `InsufficientCreditsError` — `err.required`, `err.available`
- `ActionNotFoundError` — `err.actionSlug`

#### `<LughCreditsBadge>`

Displays the user's credit balance with a breakdown tooltip.

```tsx
<LughCreditsBadge
  title="My Credits"                              // optional
  blockSubscriptionLabel={(plan) => `${plan} plan`} // optional
  blockPackLabel="Credit pack"                     // optional
  emptyLabel="No credits"                          // optional
  className="my-class"                             // optional
/>
```

---

### `lugh-sdk/credits/api`

Server-side client for confirming, refunding, and cancelling credit requests. **This must only run on your server** — never expose `appSecret` to the browser.

#### `LughCreditsClient`

```ts
import { LughCreditsClient } from "lugh-sdk/credits/api";

const lugh = new LughCreditsClient({
  cloudUrl: process.env.LUGH_CLOUD_URL!,
  appSecret: process.env.LUGH_APP_SECRET!,
  appSlug: "your-app-slug",
});
```

##### `consumeCreditRequest(args)`

Confirms a pending credit request, capturing the reserved credits.

```ts
const result = await lugh.consumeCreditRequest({
  userId: "user-id",                    // sub claim from access token
  requestId: "request-id",             // from openCreditRequest / ConsumeCreditsButton
  expectedActionSlug: "generate-image", // must match the original action
});

if (result.success) {
  // result.creditsCharged — number of credits consumed
  // result.requestId
} else {
  // result.reason — "action_mismatch" (possible tampering)
}
```

##### `refundCreditRequest(args)`

Refunds a concluded (consumed) request, returning credits to the user.

```ts
await lugh.refundCreditRequest({
  userId: "user-id",
  requestId: "request-id",
  reason: "Generation failed due to server error",
});
```

##### `cancelCreditRequest(args)`

Cancels a pending request, releasing the reserved credits without charging.

```ts
await lugh.cancelCreditRequest({
  userId: "user-id",
  requestId: "request-id",
});
```

##### `getCreditRequest(args)`

Fetches the current state of a credit request.

```ts
const request = await lugh.getCreditRequest({
  userId: "user-id",
  requestId: "request-id",
});
// request.status — "pending" | "concluded" | "refunded" | "cancelled" | "expired" | "suspected_fraud"
// request.creditsAmount, request.expectedActionSlug, request.environment, ...
```

##### `validateAction(args)`

Verifies that a credit request belongs to your app.

```ts
const { valid } = await lugh.validateAction({
  requestId: "request-id",
});
```

---

### `lugh-sdk/oauth/browser`

Low-level OAuth 2.0 client with PKCE for SPAs. Use this when you need full control over the flow without React.

#### `LughOAuthClient`

```ts
import { LughOAuthClient } from "lugh-sdk/oauth/browser";

const client = await LughOAuthClient.init({
  clientId: "your-app-slug",
  redirectUri: "http://localhost:3000",
  apiUrl: "https://app.lugh.digital",
  scope: ["credits"],               // optional
  language: "en",                    // optional
  storage: new SessionStorageAdapter(), // optional — custom TokenStorage
  autoRefreshSkewMs: 60_000,         // optional — refresh 60s before expiry
  fetchImpl: fetch,                  // optional — custom fetch
});

// Sign in (redirects to Lugh)
await client.signIn({ prompt: "consent" });

// Check state
client.isSignedIn; // boolean

// Get tokens
const tokens = await client.getTokens();
const accessToken = await client.getAccessToken(); // auto-refreshes if needed

// Manual refresh
const newTokens = await client.refresh();

// Sign out (revokes tokens + clears storage)
await client.signOut();

// Events
const unsub = client.on("signin", (tokens) => { /* ... */ });
client.on("signout", () => { /* ... */ });
client.on("refresh", (tokens) => { /* ... */ });
client.on("error", (err) => { /* ... */ });
unsub(); // unsubscribe
```

#### Utilities

```ts
import {
  createPkcePair,    // () => Promise<{ verifier, challenge, method: "S256" }>
  createVerifier,    // () => string
  createChallenge,   // (verifier: string) => Promise<string>
  decodeIdToken,     // <T>(token: string) => T | null (no signature verification)
  SessionStorageAdapter, // TokenStorage implementation using sessionStorage
} from "lugh-sdk/oauth/browser";
```

---

### `lugh-sdk/oauth/server`

Server-side OAuth helpers for Node.js and Edge runtimes.

#### `LughSso`

Core SSO client. Handles authorization requests, code exchange, token refresh, and revocation.

```ts
import { LughSso } from "lugh-sdk/oauth/server";

const sso = new LughSso({
  clientId: "your-app-slug",
  redirectUri: "https://yourapp.com/auth/callback",
  apiUrl: "https://app.lugh.digital",
  scope: ["openid", "profile", "email", "credits"],
  language: "en",
});

// 1. Create authorization URL
const { url, state, nonce, codeVerifier } = await sso.createAuthorizationRequest();
// Store state, nonce, codeVerifier in session/cookie, then redirect to url

// 2. Exchange code for tokens (in callback handler)
const tokens = await sso.exchangeCode({
  code: searchParams.get("code"),
  codeVerifier: storedCodeVerifier,
});

// 3. Refresh tokens
const fresh = await sso.refresh(tokens.refreshToken);

// 4. Get user info
const user = await sso.userinfo(tokens.accessToken);
// user.sub, user.email, user.name, user.picture

// 5. Decode ID token (no signature verification — display only)
const claims = sso.decodeIdToken(tokens.idToken);

// 6. Revoke tokens (sign out)
await sso.revoke({ token: tokens.refreshToken, hint: "refresh_token" });
```

#### `LughSsoSession`

Manages token persistence and auto-refresh for a single user session.

```ts
import { LughSso, LughSsoSession, InMemoryTokenStore } from "lugh-sdk/oauth/server";

const store = new InMemoryTokenStore();

const session = new LughSsoSession({
  sso,
  store,
  userId: "user-123",
});

// Save tokens after code exchange
await session.save(tokens);

// Get a valid access token (auto-refreshes if needed)
const accessToken = await session.getAccessToken();

// Load raw token set
const tokenSet = await session.load();

// Sign out (revokes + deletes stored tokens)
await session.signOut();
```

#### `LughBrowserSession`

Cookie-based session manager for server-rendered apps (Next.js, Express, etc.).

```ts
import { LughSso, LughBrowserSession, InMemoryTokenStore } from "lugh-sdk/oauth/server";

const browserSession = new LughBrowserSession({
  sso,
  store: new InMemoryTokenStore(),
  cookie: myCookieAdapter, // { read(req, name), build({ name, value, ... }) }
  sessionCookieName: "lugh_session",
  sessionMaxAgeSeconds: 86400,
});

// Start sign-in (returns redirect Response)
const response = await browserSession.startSignIn(request);

// Handle callback (returns redirect Response with session cookie)
const response = await browserSession.handleCallback(request);

// Get access token from session cookie
const accessToken = await browserSession.getAccessToken(request);

// Sign out (returns redirect Response clearing cookies)
const response = await browserSession.signOut(request);
```

#### Token stores

```ts
import { InMemoryTokenStore, ConvexTokenStore } from "lugh-sdk/oauth/server";

// In-memory (development / single-instance)
const memStore = new InMemoryTokenStore();

// Convex-backed (production / multi-instance)
const convexStore = new ConvexTokenStore({
  client: convexClient,
  api: {
    load: api.tokenStore.load,
    save: api.tokenStore.save,
    remove: api.tokenStore.remove,
  },
});
```

---

## Credit request lifecycle

```
User clicks button          Your server confirms
       |                           |
       v                           v
 [openCreditRequest]  --->  [consumeCreditRequest]  --->  concluded
   status: pending             status: concluded
   credits: reserved          credits: captured
       |                           |
       v                           v
 [cancelCreditRequest]      [refundCreditRequest]
   status: cancelled          status: refunded
   credits: released          credits: returned
```

1. **Open** — User clicks `<LughConsumeCreditsButton>`, credits are reserved (status: `pending`)
2. **Consume** — Your server confirms the action succeeded, credits are captured (status: `concluded`)
3. **Cancel** — Your server cancels if the action didn't run, credits are released (status: `cancelled`)
4. **Refund** — Your server refunds after a concluded request, credits are returned (status: `refunded`)
5. **Expire** — If not consumed/cancelled within 6 hours, the request expires and credits are released automatically

## Security considerations

- **`appSecret` is server-only** — Never import `lugh-sdk/credits/api` in client-side code. The `appSecret` grants full control over credit operations for your app.
- **Validate the `sub` claim** — When your server receives a `requestId`, verify the user's identity from the access token `sub` claim before confirming.
- **Use `idempotencyKey`** — Prevent duplicate charges by passing a unique key per user action.
- **HTTPS required** — All OAuth flows must run over HTTPS in production.
- **Token storage** — Browser tokens are stored in `sessionStorage` by default (cleared when the tab closes). For sensitive applications, consider the BFF (Backend-For-Frontend) pattern with `lugh-sdk/oauth/server`.

## TypeScript

The SDK is fully typed. All types are exported from their respective subpaths:

```ts
import type {
  LughOAuthOptions,
  LughTokens,
  Scope,
  TokenStorage,
  LughAuthEvent,
} from "lugh-sdk/oauth/browser";

import type {
  LughSsoOptions,
  LughTokenSet,
  LughUserinfo,
  LughIdClaims,
  TokenStore,
} from "lugh-sdk/oauth/server";

import type {
  LughProviderProps,
  LughContextValue,
  LughUserClaims,
  LughUser,
  Theme,
} from "lugh-sdk/oauth/react";

import type {
  LughCreditsClientOptions,
  ConsumeResult,
  CreditRequest,
  CreditRequestStatus,
  LughEnvironment,
} from "lugh-sdk/credits/api";

import type {
  LughBalance,
  LughBalanceBreakdown,
  LughAppAction,
  UseCreditsResult,
  ConsumeCreditsResult,
  LughConsumeCreditsButtonProps,
  LughCreditsBadgeProps,
} from "lugh-sdk/credits/react";
```

## License

MIT
