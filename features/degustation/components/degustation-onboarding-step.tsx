"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import {
  FavoritesAuthModal,
  type FavoritesAuthModalCopy,
} from "@/components/shared/favorites-auth-modal";
import { buttonVariants } from "@/components/ui/button-variants";
import { DEGUST_MAIN_VIEWPORT } from "@/features/degustation/constants";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { cn } from "@/lib/utils";

/** Plein écran dans <main> — aucun scroll. */
const VIEWPORT = cn(
  DEGUST_MAIN_VIEWPORT,
  "flex min-h-0 w-full flex-col overflow-hidden",
);

type Props = {
  step: 1 | 2 | 3;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName?: string;
  title: string;
  body: string;
  nextHref: string;
  prevHref: string | null;
  isLastStep: boolean;
  labels: Dictionary["degustation"];
  /** Si défini (invité sur dernière étape), ouvre la modale auth au lieu d’aller à nextHref. */
  authGate?: {
    copy: FavoritesAuthModalCopy;
    nextPath: string;
  } | null;
};

export function DegustationOnboardingStep({
  step,
  imageSrc,
  imageWidth,
  imageHeight,
  imageClassName = "h-14 w-auto object-contain sm:h-24 md:h-28",
  title,
  body,
  nextHref,
  prevHref,
  isLastStep,
  labels,
  authGate = null,
}: Props) {
  const router = useRouter();
  const touchStartX = useRef<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const loginHref = useMemo(
    () =>
      authGate
        ? `/login?next=${encodeURIComponent(authGate.nextPath)}`
        : "",
    [authGate],
  );
  const registerHref = useMemo(
    () =>
      authGate
        ? `/signup?next=${encodeURIComponent(authGate.nextPath)}`
        : "",
    [authGate],
  );

  const progressLabel = labels.progressStep.replace("{step}", String(step));
  const progressWidth = (step / 3) * 100;

  const useAuthGate = Boolean(isLastStep && authGate);

  const goForward = () => {
    if (useAuthGate && authGate) {
      setAuthOpen(true);
      return;
    }
    router.push(nextHref);
  };

  const goBack = () => {
    if (prevHref) router.push(prevHref);
    else router.push("/degustation");
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -48) {
      goForward();
    } else if (dx > 48) {
      goBack();
    }
  };

  const primaryLabel = isLastStep ? labels.finish : labels.next;

  return (
    <div
      className={VIEWPORT}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="shrink-0 space-y-1.5 pt-0 sm:space-y-2 md:space-y-3">
        <p className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
          {progressLabel}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted sm:h-1.5">
          <div
            className="h-full rounded-full bg-wine transition-[width] duration-700 ease-in-out"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 py-3 text-center sm:px-5 sm:py-4 md:py-6">
        <div className="degust-float mb-3 shrink-0 text-wine sm:mb-5 md:mb-6">
          <Image
            src={imageSrc}
            alt=""
            width={imageWidth}
            height={imageHeight}
            className={cn(imageClassName)}
            priority
          />
        </div>
        <h1 className="shrink-0 font-heading text-2xl font-semibold tracking-tight text-wine sm:text-3xl md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-md min-h-0 min-w-0 text-pretty text-[12px] leading-snug text-neutral-600 whitespace-pre-line sm:mt-3 sm:max-w-lg sm:text-[15px] sm:leading-relaxed md:text-base dark:text-neutral-400">
          {body}
        </p>
      </div>

      <footer className="mt-auto shrink-0 border-t border-border/50 bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-backdrop-filter:bg-background/85 sm:px-4 sm:py-4 md:py-5">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
          <Link
            href="/degustation"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "order-2 w-full sm:order-1 sm:w-auto",
            )}
          >
            {labels.skip}
          </Link>
          {useAuthGate ? (
            <button
              type="button"
              onClick={goForward}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "order-1 w-full bg-wine text-primary-foreground hover:opacity-90 sm:order-2 sm:min-w-44",
              )}
            >
              {primaryLabel}
            </button>
          ) : (
            <Link
              href={nextHref}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "order-1 w-full bg-wine text-primary-foreground hover:opacity-90 sm:order-2 sm:min-w-44",
              )}
            >
              {primaryLabel}
            </Link>
          )}
        </div>
      </footer>
      {authGate ? (
        <FavoritesAuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          copy={authGate.copy}
          loginHref={loginHref}
          registerHref={registerHref}
        />
      ) : null}
    </div>
  );
}
