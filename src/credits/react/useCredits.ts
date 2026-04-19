"use client";

import { useEffect, useMemo, useState } from "react";
import { useLugh } from "../../oauth/react/useLugh.js";
import { useInternalConvex } from "../../oauth/react/internal-convex.js";
import { getBalanceBreakdown } from "./cloud-api.js";
import type {
  LughBalance,
  LughBalanceBreakdown,
  UseCreditsOptions,
  UseCreditsResult,
} from "./types.js";

export function useCredits(opts: UseCreditsOptions = {}): UseCreditsResult {
  const { isSignedIn, clientId } = useLugh();
  const convex = useInternalConvex();

  const env = opts.environment ?? "production";
  const appSlug = opts.appSlug ?? clientId;

  const skip = !isSignedIn || !convex;
  const argsKey = skip ? null : JSON.stringify({ environment: env === "sandbox" ? "sandbox" : undefined, appSlug: env === "sandbox" ? appSlug : undefined });

  const [data, setData] = useState<LughBalanceBreakdown | null | undefined>(undefined);

  useEffect(() => {
    if (skip || !convex) {
      setData(undefined);
      return;
    }

    const args = env === "sandbox"
      ? { environment: "sandbox" as const, appSlug }
      : {};

    const unsubscribe = convex.onUpdate(getBalanceBreakdown, args, (result) => {
      setData(result);
    });

    return () => { unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, convex, argsKey]);

  const loading = isSignedIn && data === undefined;
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
      refetch: () => {},
    }),
    [balance, breakdown, loading],
  );
}
