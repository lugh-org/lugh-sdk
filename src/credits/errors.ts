// Typed errors surfaced to SDK consumers. Mantidos aqui (fora de
// `react/` e `api/`) porque são usados tanto pelos hooks React quanto pelo
// `LughCreditsClient` server-side.
//
// ConvexError do backend sobe pro cliente como objeto com `.data.code`
// (stable) + `.data.message` (human-readable). `translateConvexError` mapeia
// códigos conhecidos pras classes abaixo — o resto passa inalterado pra não
// esconder erros de rede / validação genérica.

export class AppNotApprovedError extends Error {
  readonly code = "app_not_approved" as const;
  constructor(message: string) {
    super(message);
    this.name = "AppNotApprovedError";
  }
}

type ConvexErrorLike = { data?: { code?: string; message?: string } };

function hasConvexData(err: unknown): err is ConvexErrorLike {
  return (
    err !== null &&
    typeof err === "object" &&
    "data" in err &&
    typeof (err as ConvexErrorLike).data === "object"
  );
}

export function translateConvexError(err: unknown): Error {
  if (hasConvexData(err)) {
    const { code, message } = err.data ?? {};
    if (code === "app_not_approved") {
      return new AppNotApprovedError(
        message ?? "App is not approved for production use.",
      );
    }
  }
  return err instanceof Error ? err : new Error(String(err));
}
