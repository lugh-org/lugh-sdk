"use client";

import { useState, type JSX, type ReactNode } from "react";
import { useLugh } from "../../../oauth/react/useLugh.js";
import { getMessages } from "../../../oauth/react/i18n.js";
import { useActions } from "../useActions.js";
import { useCredits } from "../useCredits.js";
import { useConsumeCredits } from "../useConsumeCredits.js";
import { DEFAULT_PRICING_URL } from "./CreditsBadge.js";
import type { ConsumeCreditsResult, LughEnvironment } from "../types.js";

export class InsufficientCreditsError extends Error {
  readonly code = "insufficient_credits" as const;
  readonly required: number;
  readonly available: number;
  constructor(required: number, available: number, message: string) {
    super(message);
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.available = available;
  }
}

export class ActionNotFoundError extends Error {
  readonly code = "action_not_found" as const;
  readonly actionSlug: string;
  constructor(actionSlug: string) {
    super(`No action registered with slug "${actionSlug}".`);
    this.name = "ActionNotFoundError";
    this.actionSlug = actionSlug;
  }
}

export type LughConsumeCreditsButtonProps = {
  appSlug?: string;
  actionSlug: string;
  environment?: LughEnvironment;
  idempotencyKey?: string;
  upgradeUrl?: string;
  children?: ReactNode | ((cost: number | null) => ReactNode);
  className?: string;
  classOverride?: string;
  disabled?: boolean;
  loadingLabel?: ReactNode;
  onClick?: (ctx: ConsumeCreditsResult) => void | Promise<void>;
  onSuccess?: (ctx: ConsumeCreditsResult) => void;
  onError?: (err: Error) => void;
};

export function LughConsumeCreditsButton({
  appSlug,
  actionSlug,
  environment,
  idempotencyKey,
  upgradeUrl,
  children,
  className,
  classOverride,
  disabled,
  loadingLabel,
  onClick,
  onSuccess,
  onError,
}: LughConsumeCreditsButtonProps): JSX.Element {
  const { isSignedIn, clientId, language } = useLugh();
  const t = getMessages(language);
  const resolvedAppSlug = appSlug ?? clientId;
  const { actions, loading: actionsLoading, bySlug } = useActions(resolvedAppSlug);
  const { balance } = useCredits(
    environment ? { environment, appSlug: resolvedAppSlug } : { appSlug: resolvedAppSlug },
  );
  const createConsumeRequest = useConsumeCredits();
  const [loading, setLoading] = useState<boolean>(false);
  const [insufficient, setInsufficient] = useState<boolean>(false);
  const resolvedUpgradeUrl = upgradeUrl ?? DEFAULT_PRICING_URL;

  const action = bySlug(actionSlug);
  const cost = action?.amount ?? null;
  const total = balance?.total ?? 0;
  const hasEnough = cost !== null && total >= cost;

  const handleClick = async (): Promise<void> => {
    if (!isSignedIn) {
      onError?.(new Error("user not signed in"));
      return;
    }
    if (cost === null) {
      // `actions` may still be loading; don't surface a "not found" yet.
      if (actionsLoading || actions.length === 0) return;
      onError?.(new ActionNotFoundError(actionSlug));
      return;
    }
    if (total < cost) {
      setInsufficient(true);
      onError?.(
        new InsufficientCreditsError(cost, total, t.insufficientCredits),
      );
      return;
    }
    setInsufficient(false);
    setLoading(true);
    try {
      const ctx = await createConsumeRequest({
        appSlug: resolvedAppSlug,
        actionSlug,
        ...(environment ? { environment } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
      if (onClick) await onClick(ctx);
      onSuccess?.(ctx);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  const resolvedChildren =
    typeof children === "function" ? children(cost) : children;

  const label = loading
    ? loadingLabel ?? t.consumeLoading
    : resolvedChildren ?? (cost !== null ? t.consumeDefault(cost) : t.consumeLoading);

  return (
    <div className="lugh-consume">
      <button
        type="button"
        className={`${classOverride ?? "lugh-btn lugh-btn--gradient"}${className ? ` ${className}` : ""}`}
        onClick={() => {
          void handleClick();
        }}
        disabled={
          disabled ||
          loading ||
          !isSignedIn ||
          actionsLoading ||
          cost === null ||
          !hasEnough
        }
        aria-busy={loading}
      >
        {label}
      </button>

      {(insufficient || (isSignedIn && cost !== null && !hasEnough)) && (
        <p className="lugh-consume__insufficient" role="alert">
          <span>{t.insufficientCredits}</span>{" "}
          <a
            className="lugh-consume__link"
            href={resolvedUpgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.getMoreCredits}
          </a>
        </p>
      )}
    </div>
  );
}
