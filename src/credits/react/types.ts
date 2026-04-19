import type { LughEnvironment } from "../api/types.js";

export type LughCreditBlock = {
  id: string;
  plan: string | null;
  amount: number;
  used: number;
  remaining: number;
  startedAt: number;
  expiresAt: number;
};

export type LughBalanceBreakdown = {
  blocks: LughCreditBlock[];
  subscription: number;
  packs: number;
  sandbox: number;
  total: number;
  reserved: number;
  available: number;
};

export type LughBalance = {
  total: number;
  reserved: number;
  available: number;
};

export type LughAppAction = {
  slug: string;
  name: string;
  amount: number;
  description?: string;
};

export type UseCreditsResult = {
  balance: LughBalance | null;
  breakdown: LughBalanceBreakdown | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export type UseActionsResult = {
  actions: LughAppAction[];
  loading: boolean;
  bySlug: (slug: string) => LughAppAction | null;
};

export type UseCreditsOptions = {
  environment?: LughEnvironment;
  appSlug?: string;
};

export type ConsumeCreditsArgs = {
  appSlug?: string;
  actionSlug: string;
  environment?: LughEnvironment;
  idempotencyKey?: string;
};

export type ConsumeCreditsResult = {
  requestId: string;
  expiresAt: number;
  creditsReserved: number;
};

export type { LughEnvironment };
