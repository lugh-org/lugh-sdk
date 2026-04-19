"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from "react";
import { useLugh } from "../useLugh.js";
import { useUser, type LughUser } from "../useUser.js";
import { getMessages } from "../i18n.js";

export type LughUserProfileProps = {
  /** Pixel size of the avatar button. Default: 36. */
  size?: number;
  /** Appended to the default avatar button classes. */
  className?: string;
  /** Replaces the default avatar button class list entirely. */
  classOverride?: string;
  /** Extra content rendered inside the popover (below the sign-out action). */
  children?: (user: LughUser) => ReactNode;
  /** Hide the sign-out button inside the popover. Default: false. */
  hideSignOut?: boolean;
  /** Override label for the sign-out action. Default: i18n-aware. */
  signOutLabel?: string;
  onSignOut?: () => void;
  onError?: (err: Error) => void;
};

export function LughUserProfile({
  size = 36,
  className,
  classOverride,
  children,
  hideSignOut = false,
  signOutLabel,
  onSignOut,
  onError,
}: LughUserProfileProps): JSX.Element | null {
  const { isSignedIn, signOut, language } = useLugh();
  const user = useUser();
  const t = getMessages(language);
  const [open, setOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isSignedIn || !user) return null;

  const handleSignOut = async (): Promise<void> => {
    setOpen(false);
    onSignOut?.();
    try {
      await signOut();
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const sizeStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
  };
  const baseClass = classOverride ?? "lugh-user__avatar";
  const avatarClass = `${baseClass}${className ? ` ${className}` : ""}`;
  const resolvedSignOutLabel = signOutLabel ?? t.signOut;

  return (
    <div ref={rootRef} className="lugh-user">
      <button
        type="button"
        className={avatarClass}
        style={sizeStyle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={user.displayName ?? user.sub}
      >
        {user.picture ? (
          <img
            className="lugh-user__avatar-img"
            src={user.picture}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="lugh-user__avatar-initials">{user.initials}</span>
        )}
      </button>

      {open && (
        <div className="lugh-user__panel" role="dialog">
          <div className="lugh-user__header">
            <div className="lugh-user__avatar-lg" aria-hidden="true">
              {user.picture ? (
                <img
                  className="lugh-user__avatar-img"
                  src={user.picture}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="lugh-user__avatar-initials">
                  {user.initials}
                </span>
              )}
            </div>
            <div className="lugh-user__identity">
              {user.displayName && (
                <span className="lugh-user__name">{user.displayName}</span>
              )}
              {user.email && (
                <span className="lugh-user__email">{user.email}</span>
              )}
            </div>
          </div>

          {children && <div className="lugh-user__extra">{children(user)}</div>}

          {!hideSignOut && (
            <button
              type="button"
              className="lugh-user__signout"
              onClick={() => {
                void handleSignOut();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {resolvedSignOutLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
