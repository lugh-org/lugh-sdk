"use client";

import { useEffect, useMemo, useState } from "react";
import { useInternalConvex } from "../../oauth/react/internal-convex.js";
import { listAppActions } from "./cloud-api.js";
import type { LughAppAction, UseActionsResult } from "./types.js";

const CACHE_PREFIX = "lugh:actions:";

function readCached(appSlug: string): LughAppAction[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + appSlug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (a): a is LughAppAction =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as { slug?: unknown }).slug === "string" &&
        typeof (a as { amount?: unknown }).amount === "number" &&
        typeof (a as { name?: unknown }).name === "string",
    );
  } catch {
    return null;
  }
}

function writeCached(appSlug: string, actions: LughAppAction[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + appSlug, JSON.stringify(actions));
  } catch {
    // quota/cookies off — ignore
  }
}

export function useActions(appSlug: string): UseActionsResult {
  const convex = useInternalConvex();

  const [cached, setCached] = useState<LughAppAction[] | null>(() =>
    readCached(appSlug),
  );
  const [fresh, setFresh] = useState<LughAppAction[] | undefined>(undefined);

  useEffect(() => {
    setCached(readCached(appSlug));
  }, [appSlug]);

  useEffect(() => {
    if (!convex) {
      setFresh(undefined);
      return;
    }

    const unsubscribe = convex.onUpdate(
      listAppActions,
      { appSlug },
      (result) => {
        setFresh(result);
        writeCached(appSlug, result);
        setCached(result);
      },
    );

    return () => { unsubscribe(); };
  }, [convex, appSlug]);

  const actions = fresh ?? cached ?? [];
  const loading = fresh === undefined && cached === null;

  return useMemo(
    () => ({
      actions,
      loading,
      bySlug: (slug) => actions.find((a) => a.slug === slug) ?? null,
    }),
    [actions, loading],
  );
}
