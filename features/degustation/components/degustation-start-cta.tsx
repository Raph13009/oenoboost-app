"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  FavoritesAuthModal,
  type FavoritesAuthModalCopy,
} from "@/components/shared/favorites-auth-modal";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const START_PATH = "/degustation/oeil/start";

type Props = {
  isLoggedIn: boolean;
  ctaLabel: string;
  className?: string;
  authCopy: FavoritesAuthModalCopy;
};

export function DegustationStartCta({
  isLoggedIn,
  ctaLabel,
  className,
  authCopy,
}: Props) {
  const [authOpen, setAuthOpen] = useState(false);

  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(START_PATH)}`,
    [],
  );
  const registerHref = useMemo(
    () => `/signup?next=${encodeURIComponent(START_PATH)}`,
    [],
  );

  if (isLoggedIn) {
    return (
      <Link
        href={START_PATH}
        className={cn(
          buttonVariants({ variant: "default", size: "lg" }),
          "min-w-[min(100%,18rem)] bg-wine px-8 text-primary-foreground hover:opacity-90 sm:px-10",
          className,
        )}
      >
        {ctaLabel}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAuthOpen(true)}
        className={cn(
          buttonVariants({ variant: "default", size: "lg" }),
          "min-w-[min(100%,18rem)] bg-wine px-8 text-primary-foreground hover:opacity-90 sm:px-10",
          className,
        )}
      >
        {ctaLabel}
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
