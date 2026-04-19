import { ConvexHttpClient } from "convex/browser";
import {
  cancelCreditRequest as cancelRef,
  consumeCreditRequest as consumeRef,
  getCreditRequest as getRef,
  refundCreditRequest as refundRef,
} from "./convex-api.js";
import type {
  ConsumeResult,
  CreditRequest,
  LughCreditsClientOptions,
} from "./types.js";

export class LughCreditsClient {
  private readonly convex: ConvexHttpClient;
  private readonly appSecret: string;
  private readonly appSlug: string;

  constructor(opts: LughCreditsClientOptions) {
    if (!opts?.cloudUrl) throw new Error("LughCreditsClient: cloudUrl is required");
    if (!opts?.appSecret) throw new Error("LughCreditsClient: appSecret is required");
    if (!opts?.appSlug) throw new Error("LughCreditsClient: appSlug is required");
    this.convex = new ConvexHttpClient(opts.cloudUrl);
    this.appSecret = opts.appSecret;
    this.appSlug = opts.appSlug;
  }

  async consumeCreditRequest(args: {
    userId: string;
    requestId: string;
    expectedActionSlug: string;
  }): Promise<ConsumeResult> {
    return this.convex.mutation(consumeRef, {
      appSecret: this.appSecret,
      appSlug: this.appSlug,
      userId: args.userId,
      requestId: args.requestId,
      expectedActionSlug: args.expectedActionSlug,
    });
  }

  async refundCreditRequest(args: {
    userId: string;
    requestId: string;
    reason?: string;
  }): Promise<void> {
    await this.convex.mutation(refundRef, {
      appSecret: this.appSecret,
      appSlug: this.appSlug,
      userId: args.userId,
      requestId: args.requestId,
      reason: args.reason ?? "",
    });
  }

  async cancelCreditRequest(args: {
    userId: string;
    requestId: string;
  }): Promise<void> {
    await this.convex.mutation(cancelRef, {
      appSecret: this.appSecret,
      appSlug: this.appSlug,
      userId: args.userId,
      requestId: args.requestId,
    });
  }

  async getCreditRequest(args: {
    userId: string;
    requestId: string;
  }): Promise<CreditRequest | null> {
    return this.convex.query(getRef, {
      appSecret: this.appSecret,
      appSlug: this.appSlug,
      userId: args.userId,
      requestId: args.requestId,
    });
  }
}
