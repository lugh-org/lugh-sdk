import type { FunctionReference } from "convex/server";
import type { LughTokenSet, TokenStore } from "./types.js";

// Structural type — avoids a hard import of `convex/browser` or
// `ConvexHttpClient` so this file is safe to typecheck even when
// `convex` is not installed. The runtime dep is only realized when
// the consumer constructs a `ConvexTokenStore`.
export interface ConvexClientLike {
  query<Q extends FunctionReference<"query">>(
    query: Q,
    ...args: unknown[]
  ): Promise<Q["_returnType"]>;
  mutation<M extends FunctionReference<"mutation">>(
    mutation: M,
    ...args: unknown[]
  ): Promise<M["_returnType"]>;
}

export type GetTokensRef = FunctionReference<
  "query",
  "public",
  { userId: string },
  LughTokenSet | null
>;

export type SaveTokensRef = FunctionReference<
  "mutation",
  "public",
  { userId: string; tokens: LughTokenSet },
  null | void
>;

export type DeleteTokensRef = FunctionReference<
  "mutation",
  "public",
  { userId: string },
  null | void
>;

export type TokenStoreFunctionRefs = {
  load: GetTokensRef;
  save: SaveTokensRef;
  remove: DeleteTokensRef;
};

export type ConvexTokenStoreOptions = {
  client: ConvexClientLike;
  api: TokenStoreFunctionRefs;
};

export class ConvexTokenStore implements TokenStore {
  private readonly client: ConvexClientLike;
  private readonly api: TokenStoreFunctionRefs;

  constructor(opts: ConvexTokenStoreOptions) {
    this.client = opts.client;
    this.api = opts.api;
  }

  async load(userId: string): Promise<LughTokenSet | null> {
    return this.client.query(this.api.load, { userId });
  }

  async save(userId: string, tokens: LughTokenSet): Promise<void> {
    await this.client.mutation(this.api.save, { userId, tokens });
  }

  async delete(userId: string): Promise<void> {
    await this.client.mutation(this.api.remove, { userId });
  }
}
