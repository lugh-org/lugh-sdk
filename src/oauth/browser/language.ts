export type Language = "pt" | "en" | "es";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["pt", "en", "es"];
export const DEFAULT_LANGUAGE: Language = "en";

export function isSupportedLanguage(lang: string): lang is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}
