"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  FavoritesAuthModal,
  type FavoritesAuthModalCopy,
} from "@/components/shared/favorites-auth-modal";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  isLoggedIn: boolean;
  label: string;
  className?: string;
  authCopy: FavoritesAuthModalCopy;
  children?: ReactNode;
};

export function DailyQuestionCta({
  href,
  isLoggedIn,
  label,
  className,
  authCopy,
  children,
}: Props) {
  const [authOpen, setAuthOpen] = useState(false);

  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(href)}`,
    [href],
  );
  const registerHref = useMemo(
    () => `/signup?next=${encodeURIComponent(href)}`,
    [href],
  );

  if (isLoggedIn) {
    return (
      <Link href={href} prefetch className={cn(className)}>
        {children ?? label}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAuthOpen(true)}
        className={cn(className)}
      >
        {children ?? label}
      </button>

      <FavoritesAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        copy={authCopy}
        loginHref={loginHref}
        registerHref={registerHref}
      />
    </>
  );
}
