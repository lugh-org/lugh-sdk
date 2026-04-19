// Typed FunctionReferences for `partnerServerApi:*` in lugh-app. The
// reference string is `<file>:<name>` within that deployment's `convex/`
// folder — if it ever moves, update here (there's no build-time check).

import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { ConsumeResult, CreditRequest } from "./types.js";

export type ConsumeCreditRequestRef = FunctionReference<
  "mutation",
  "public",
  {
    appSecret: string;
    userId: string;
    appSlug: string;
    requestId: string;
    expectedActionSlug: string;
  },
  ConsumeResult
>;

export type RefundCreditRequestRef = FunctionReference<
  "mutation",
  "public",
  {
    appSecret: string;
    userId: string;
    appSlug: string;
    requestId: string;
    reason: string;
  },
  { success: boolean }
>;

export type CancelCreditRequestRef = FunctionReference<
  "mutation",
  "public",
  {
    appSecret: string;
    userId: string;
    appSlug: string;
    requestId: string;
  },
  { success: boolean }
>;

export type GetCreditRequestRef = FunctionReference<
  "query",
  "public",
  {
    appSecret: string;
    userId: string;
    appSlug: string;
    requestId: string;
  },
  CreditRequest | null
>;

export type ValidateActionRef = FunctionReference<
  "query",
  "public",
  {
    requestId: string;
    appSecretKey: string;
    expectedAppSlug: string;
  },
  { valid: boolean }
>;

export const consumeCreditRequest = makeFunctionReference<"mutation">(
  "partnerServerApi:consumeCreditRequest",
) as ConsumeCreditRequestRef;

export const refundCreditRequest = makeFunctionReference<"mutation">(
  "partnerServerApi:refundCreditRequest",
) as RefundCreditRequestRef;

export const cancelCreditRequest = makeFunctionReference<"mutation">(
  "partnerServerApi:cancelCreditRequest",
) as CancelCreditRequestRef;

export const getCreditRequest = makeFunctionReference<"query">(
  "partnerServerApi:getCreditRequest",
) as GetCreditRequestRef;

export const validateAction = makeFunctionReference<"query">(
  "partnerServerApi:validateAction",
) as ValidateActionRef;
