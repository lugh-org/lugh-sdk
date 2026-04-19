// Public FunctionReferences for `partnerApi:*` in lugh-app — the
// OAuth-authenticated entrypoints the browser consumes. Backend only
// (appSecret) calls live in `credits/api/convex-api.ts`.

import { makeFunctionReference, type FunctionReference } from "convex/server";
import type {
  LughAppAction,
  LughBalance,
  LughBalanceBreakdown,
  LughEnvironment,
} from "./types.js";

export type GetBalanceRef = FunctionReference<
  "query",
  "public",
  { environment?: LughEnvironment; appSlug?: string },
  LughBalance
>;

export type GetBalanceBreakdownRef = FunctionReference<
  "query",
  "public",
  { environment?: LughEnvironment; appSlug?: string },
  LughBalanceBreakdown | null
>;

export type OpenCreditRequestRef = FunctionReference<
  "mutation",
  "public",
  {
    appSlug: string;
    actionSlug: string;
    environment: LughEnvironment;
    idempotencyKey?: string;
  },
  { requestId: string; expiresAt: number; creditsReserved: number }
>;

export type ListAppActionsRef = FunctionReference<
  "query",
  "public",
  { appSlug: string },
  LughAppAction[]
>;

export const getBalance = makeFunctionReference<"query">(
  "partnerApi:getBalance",
) as GetBalanceRef;

export const getBalanceBreakdown = makeFunctionReference<"query">(
  "partnerApi:getBalanceBreakdown",
) as GetBalanceBreakdownRef;

export const openCreditRequest = makeFunctionReference<"mutation">(
  "partnerApi:openCreditRequest",
) as OpenCreditRequestRef;

export const listAppActions = makeFunctionReference<"query">(
  "partnerApi:listAppActions",
) as ListAppActionsRef;
