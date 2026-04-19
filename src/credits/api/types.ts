export type LughEnvironment = "production" | "sandbox";

export type CreditRequestStatus =
  | "pending"
  | "concluded"
  | "refunded"
  | "cancelled"
  | "expired"
  | "suspected_fraud";

export type CreditRequest = {
  _id: string;
  userId: string;
  appId: string;
  actionId: string;
  expectedActionSlug: string;
  creditsAmount: number;
  status: CreditRequestStatus;
  environment: LughEnvironment;
  expiresAt: number;
  createdAt?: number;
  updatedAt?: number;
  concludedAt?: number | null;
  refundedAt?: number | null;
  cancelledAt?: number | null;
  idempotencyKey?: string | null;
  refundReason?: string | null;
};

export type ConsumeResult =
  | { success: true; creditsCharged: number; requestId: string }
  | { success: false; reason: "action_mismatch" };

export type LughCreditsClientOptions = {
  cloudUrl: string;
  appSecret: string;
  appSlug: string;
};
