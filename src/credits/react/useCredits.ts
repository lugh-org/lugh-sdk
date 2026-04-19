"use client";

import { useMemo } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useLugh } from "../../oauth/react/useLugh.js";
import { getBalanceBreakdown } from "./convex-api.js";
import type {
  LughBalance,
  LughBalanceBreakdown,
  UseCreditsOptions,
  UseCreditsResult,
} from "./types.js";

type Args = { environment?: "production" | "sandbox"; appSlug?: string };

export function useCredits(opts: UseCreditsOptions = {}): UseCreditsResult {
  const { isSignedIn, clientId } = useLugh();
  const { isAuthenticated } = useConvexAuth();

  const env = opts.environment ?? "production";
  const appSlug = opts.appSlug ?? clientId;

  const queryArgs: Args | "skip" = useMemo(() => {
    if (!isSignedIn || !isAuthenticated) return "skip";
    if (env === "sandbox") return { environment: "sandbox", appSlug };
    return {};
  }, [isSignedIn, isAuthenticated, env, appSlug]);

  const data = useQuery(getBalanceBreakdown, queryArgs);

  const loading = isSignedIn && (!isAuthenticated || data === undefined);
  const breakdown: LughBalanceBreakdown | null = data ?? null;
  const total =
    env === "sandbox" ? breakdown?.sandbox ?? 0 : breakdown?.total ?? 0;

  const balance: LughBalance | null = breakdown
    ? {
        total,
        reserved: breakdown.reserved ?? 0,
        available: breakdown.available ?? total,
      }
    : null;

  return useMemo<UseCreditsResult>(
    () => ({
      balance,
      breakdown,
      loading,
      error: null,
      refetch: () => {
        // Convex queries are reactive; explicit refetch is a no-op.
      },
    }),
    [balance, breakdown, loading],
  );
}
