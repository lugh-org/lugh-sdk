"use client";

import { useContext } from "react";
import { LughContext } from "./context.js";
import type { LughContextValue } from "./types.js";

export function useLugh(): LughContextValue {
  const ctx = useContext(LughContext);
  if (!ctx) {
    throw new Error("useLugh: must be used within <LughProvider>");
  }
  return ctx;
}
