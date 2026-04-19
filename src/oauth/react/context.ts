import { createContext } from "react";
import type { LughContextValue } from "./types.js";

export const LughContext = createContext<LughContextValue | null>(null);
