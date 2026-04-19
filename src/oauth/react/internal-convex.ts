"use client";

import { createContext, useContext } from "react";
import type { ConvexClient } from "convex/browser";

export const InternalConvexContext = createContext<ConvexClient | null>(null);

export function useInternalConvex(): ConvexClient | null {
  return useContext(InternalConvexContext);
}
