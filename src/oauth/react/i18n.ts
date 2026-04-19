export type Language = "pt" | "en" | "es";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["pt", "en", "es"];
export const DEFAULT_LANGUAGE: Language = "en";

export type Messages = {
  signInWithLugh: string;
  signOut: string;
  creditsTitle: string;
  creditsBalanceAria: (total: string) => string;
  creditsEmpty: string;
  creditsPackLabel: string;
  creditsUpgrade: string;
  consumeDefault: (amount: number) => string;
  consumeLoading: string;
  insufficientCredits: string;
  getMoreCredits: string;
  errorTitle: string;
  errorRetry: string;
};

const pt: Messages = {
  signInWithLugh: "Entrar com Lugh",
  signOut: "Sair",
  creditsTitle: "Créditos",
  creditsBalanceAria: (total) => `Saldo: ${total} créditos`,
  creditsEmpty: "Sem créditos disponíveis.",
  creditsPackLabel: "Pack extra",
  creditsUpgrade: "Fazer upgrade de plano",
  consumeDefault: (amount) => `Consumir ${amount} créditos`,
  consumeLoading: "...",
  insufficientCredits: "Você não possui créditos suficientes.",
  getMoreCredits: "Adquirir mais créditos",
  errorTitle: "Algo deu errado",
  errorRetry: "Tentar novamente",
};

const en: Messages = {
  signInWithLugh: "Sign in with Lugh",
  signOut: "Sign out",
  creditsTitle: "Credits",
  creditsBalanceAria: (total) => `Balance: ${total} credits`,
  creditsEmpty: "No credits available.",
  creditsPackLabel: "Extra pack",
  creditsUpgrade: "Upgrade plan",
  consumeDefault: (amount) => `Consume ${amount} credits`,
  consumeLoading: "...",
  insufficientCredits: "You don't have enough credits.",
  getMoreCredits: "Get more credits",
  errorTitle: "Something went wrong",
  errorRetry: "Try again",
};

const es: Messages = {
  signInWithLugh: "Iniciar sesión con Lugh",
  signOut: "Cerrar sesión",
  creditsTitle: "Créditos",
  creditsBalanceAria: (total) => `Saldo: ${total} créditos`,
  creditsEmpty: "Sin créditos disponibles.",
  creditsPackLabel: "Pack extra",
  creditsUpgrade: "Mejorar plan",
  consumeDefault: (amount) => `Consumir ${amount} créditos`,
  consumeLoading: "...",
  insufficientCredits: "No tienes suficientes créditos.",
  getMoreCredits: "Obtener más créditos",
  errorTitle: "Algo salió mal",
  errorRetry: "Intentar de nuevo",
};

const MESSAGES: Record<Language, Messages> = { pt, en, es };

export function isSupportedLanguage(lang: string): lang is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

export function getMessages(lang: Language | undefined): Messages {
  if (lang && isSupportedLanguage(lang)) return MESSAGES[lang];
  return MESSAGES[DEFAULT_LANGUAGE];
}
