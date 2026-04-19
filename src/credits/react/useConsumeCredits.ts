"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { useLugh } from "../../oauth/react/useLugh.js";
import { openCreditRequest } from "./convex-api.js";
import type { ConsumeCreditsArgs, ConsumeCreditsResult } from "./types.js";

export function useConsumeCredits(): (
  args: ConsumeCreditsArgs,
) => Promise<ConsumeCreditsResult> {
  const { clientId } = useLugh();
  const open = useMutation(openCreditRequest);

  return useCallback(
    async (args: ConsumeCreditsArgs): Promise<ConsumeCreditsResult> => {
      const appSlug = args.appSlug ?? clientId;
      const res = await open({
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
    [clientId, open],
  );
}
