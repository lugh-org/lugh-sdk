"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLugh } from "./useLugh.js";
import type { LughUserClaims } from "./types.js";

export type LughUser = {
  sub: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  email: string | null;
  picture: string | null;
  initials: string;
  raw: LughUserClaims;
};

const USERINFO_CACHE_PREFIX = "lugh:userinfo:";

function readString(
  claims: Record<string, unknown>,
  key: string,
): string | null {
  const v = claims[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function computeInitials(
  name: string | null,
  email: string | null,
  sub: string,
): string {
  const source = name ?? email?.split("@")[0] ?? sub;
  const parts: string[] = source
    .trim()
    .split(/\s+|[._-]+/)
    .filter((p): p is string => Boolean(p));
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function deriveUser(
  claims: LughUserClaims,
  userinfo: Record<string, unknown> | null,
): LughUser {
  // Access tokens carry only `sub`/`scope`/`iss`; `name`/`email`/`picture`
  // come from /userinfo. Merge: userinfo wins because it's always fresh
  // and carries the profile fields.
  const merged: Record<string, unknown> = { ...claims, ...(userinfo ?? {}) };
  const name = readString(merged, "name");
  const nameParts = name ? name.split(" ").filter(Boolean) : [];
  const givenName: string | null =
    readString(merged, "given_name") ?? nameParts[0] ?? null;
  const familyName: string | null =
    readString(merged, "family_name") ??
    (nameParts.length > 1 ? nameParts.slice(1).join(" ") : null);
  const email = readString(merged, "email");
  const picture = readString(merged, "picture");
  const emailLocal = email ? email.split("@")[0] ?? null : null;
  const preferred: string | null =
    name ??
    givenName ??
    readString(merged, "preferred_username") ??
    readString(merged, "nickname") ??
    emailLocal;

  return {
    sub: claims.sub,
    name,
    givenName,
    familyName,
    displayName: preferred,
    email,
    picture,
    initials: computeInitials(preferred, email, claims.sub),
    raw: claims,
  };
}

function readCached(sub: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(USERINFO_CACHE_PREFIX + sub);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function writeCached(sub: string, info: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      USERINFO_CACHE_PREFIX + sub,
      JSON.stringify(info),
    );
  } catch {
    // quota/cookies off — ignore
  }
}

export function useUser(): LughUser | null {
  const { user, accessToken, apiUrl, isSignedIn } = useLugh();
  const sub = user?.sub ?? null;

  const [userinfo, setUserinfo] = useState<Record<string, unknown> | null>(
    () => (sub ? readCached(sub) : null),
  );
  const fetchedSubRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sub) {
      setUserinfo(null);
      fetchedSubRef.current = null;
      return;
    }
    if (fetchedSubRef.current !== sub) {
      setUserinfo(readCached(sub));
    }
  }, [sub]);

  useEffect(() => {
    if (!isSignedIn || !accessToken || !sub) return;
    if (fetchedSubRef.current === sub) return;
    fetchedSubRef.current = sub;

    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const res = await fetch(`${apiUrl}/api/oauth/userinfo`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        writeCached(sub, body);
        setUserinfo(body);
      } catch {
        // silent fail — useUser still returns what the token has
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, accessToken, sub, apiUrl]);

  return useMemo(
    () => (user ? deriveUser(user, userinfo) : null),
    [user, userinfo],
  );
}
