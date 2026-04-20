"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import { LughOAuthClient } from "../browser/client.js";
import { decodeIdToken } from "../browser/idtoken.js";
import type { LughTokens, Scope } from "../browser/types.js";
import { LughContext } from "./context.js";
import { InternalConvexContext } from "./internal-convex.js";
import { detectBrowserLanguage } from "../browser/language.js";
import type { LughContextValue, LughProviderProps, LughUserClaims } from "./types.js";
export function LughProvider(props: LughProviderProps): JSX.Element {
  const {
    clientId,
    redirectUri,
    apiUrl,
    cloudUrl,
    scope,
    theme = "system",
    language = detectBrowserLanguage(),
    primaryColor,
    children,
    onError,
  } = props;

  const resolvedApiUrl = useMemo(() => apiUrl.replace(/\/+$/, ""), [apiUrl]);

  // Scope may arrive as an inline array literal; the reference changes
  // every render and would re-init the OAuth client. Serialize to a stable
  // string key for the effect dep list.
  const scopeKey = useMemo(() => (scope ? scope.join(" ") : ""), [scope]);

  const [client, setClient] = useState<LughOAuthClient | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<LughUserClaims | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const opts = {
      clientId,
      redirectUri,
      apiUrl: resolvedApiUrl,
      language,
      ...(scope ? { scope } : {}),
    };

    LughOAuthClient.init(opts)
      .then(async (instance) => {
        if (cancelled) return;

        const sync = async (): Promise<void> => {
          const tokens = await instance.getTokens();
          setIsSignedIn(instance.isSignedIn);
          setAccessToken(tokens?.accessToken ?? null);
          setUser(deriveUser(tokens));
        };

        instance.on("signin", () => {
          void sync();
        });
        instance.on("signout", () => {
          void sync();
        });
        instance.on("refresh", () => {
          void sync();
        });
        instance.on("error", (err) => {
          setError(err);
          onError?.(err);
        });

        setClient(instance);
        await sync();
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setLoading(false);
        onError?.(e);
      });

    return () => {
      cancelled = true;
    };
    // onError intentionally not in deps — it's a callback, not identity-stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, redirectUri, resolvedApiUrl, scopeKey, language]);

  const signIn = useCallback(
    async (args?: { scope?: Scope[] }): Promise<void> => {
      if (!client) throw new Error("LughProvider: client not initialized");
      await client.signIn(args ?? {});
    },
    [client],
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (!client) return;
    await client.signOut();
  }, [client]);

  const fetchAccessToken = useCallback(
    async (
      args?: { forceRefreshToken?: boolean },
    ): Promise<string | null> => {
      if (!client) return null;
      if (args?.forceRefreshToken) {
        try {
          const next = await client.refresh();
          return next.accessToken;
        } catch {
          return null;
        }
      }
      return client.getAccessToken();
    },
    [client],
  );

  const value = useMemo<LughContextValue>(
    () => ({
      client,
      isSignedIn,
      loading,
      error,
      user,
      accessToken,
      apiUrl: resolvedApiUrl,
      clientId,
      fetchAccessToken,
      signIn,
      signOut,
      language,
      theme,
    }),
    [
      client,
      isSignedIn,
      loading,
      error,
      user,
      accessToken,
      resolvedApiUrl,
      clientId,
      fetchAccessToken,
      signIn,
      signOut,
      language,
      theme,
    ],
  );

  // --- Internal ConvexClient (used by credits hooks) ---
  const convexClientRef = useRef<import("convex/browser").ConvexClient | null>(null);
  const [convexClient, setConvexClient] = useState<import("convex/browser").ConvexClient | null>(null);

  useEffect(() => {
    if (!cloudUrl) return;
    let cancelled = false;

    import("convex/browser").then(({ ConvexClient }) => {
      if (cancelled) return;
      const cx = new ConvexClient(cloudUrl);
      convexClientRef.current = cx;
      setConvexClient(cx);
    });

    return () => {
      cancelled = true;
      convexClientRef.current?.close();
      convexClientRef.current = null;
      setConvexClient(null);
    };
  }, [cloudUrl]);

  useEffect(() => {
    if (!convexClient) return;
    convexClient.setAuth(fetchAccessToken);
  }, [convexClient, fetchAccessToken]);

  const wrapperStyle: CSSProperties | undefined = primaryColor
    ? ({
        "--lugh-primary": primaryColor,
        "--lugh-primary-hover": primaryColor,
      } as CSSProperties)
    : undefined;

  return (
    <LughContext.Provider value={value}>
      <InternalConvexContext.Provider value={convexClient}>
        <div
          className="lugh-root"
          data-lugh-theme={theme === "system" ? undefined : theme}
          lang={language}
          {...(wrapperStyle ? { style: wrapperStyle } : {})}
        >
          {children}
        </div>
      </InternalConvexContext.Provider>
    </LughContext.Provider>
  );
}

function deriveUser(tokens: LughTokens | null): LughUserClaims | null {
  if (!tokens?.idToken) {
    if (tokens?.accessToken) {
      return decodeIdToken<LughUserClaims>(tokens.accessToken);
    }
    return null;
  }
  return decodeIdToken<LughUserClaims>(tokens.idToken);
}
