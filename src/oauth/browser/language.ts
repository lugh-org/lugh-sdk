export type Language = "pt" | "en" | "es";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["pt", "en", "es"];
export const DEFAULT_LANGUAGE: Language = "en";

export function isSupportedLanguage(lang: string): lang is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  const raw = (navigator.language ?? "").toLowerCase().slice(0, 2);
  return isSupportedLanguage(raw) ? raw : DEFAULT_LANGUAGE;
}
