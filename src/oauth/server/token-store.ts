import type { LughTokenSet, TokenStore } from "./types.js";

export class InMemoryTokenStore implements TokenStore {
  private readonly map = new Map<string, LughTokenSet>();

  async load(userId: string): Promise<LughTokenSet | null> {
    return this.map.get(userId) ?? null;
  }

  async save(userId: string, tokens: LughTokenSet): Promise<void> {
    this.map.set(userId, tokens);
  }

  async delete(userId: string): Promise<void> {
    this.map.delete(userId);
  }
}
