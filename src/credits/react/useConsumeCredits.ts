"use client";

import { useCallback } from "react";
import { useLugh } from "../../oauth/react/useLugh.js";
import { useInternalConvex } from "../../oauth/react/internal-convex.js";
import { openCreditRequest } from "./cloud-api.js";
import type { ConsumeCreditsArgs, ConsumeCreditsResult } from "./types.js";

export function useConsumeCredits(): (
  args: ConsumeCreditsArgs,
) => Promise<ConsumeCreditsResult> {
  const { clientId } = useLugh();
  const convex = useInternalConvex();

  return useCallback(
    async (args: ConsumeCreditsArgs): Promise<ConsumeCreditsResult> => {
      if (!convex) {
        throw new Error("useConsumeCredits: LughProvider must have a cloudUrl prop");
      }
      const appSlug = args.appSlug ?? clientId;
      const res = await convex.mutation(openCreditRequest, {
        appSlug,
        actionSlug: args.actionSlug,
        environment: args.environment ?? "production",
        ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
      });
      return {
        requestId: res.requestId,
        expiresAt: res.expiresAt,
        creditsReserved: res.creditsReserved,
      };
    },
    [clientId, convex],
  );
}
