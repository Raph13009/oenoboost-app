"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import enDict from "@/lib/i18n/dictionaries/en";
import frDict from "@/lib/i18n/dictionaries/fr";
import { useLocale } from "@/lib/i18n/locale-context";
import { PaywallModal } from "./paywall-modal";

type PremiumGateProps = {
  isPremium: boolean;
  userPlan: "free" | "premium";
  preview?: boolean;
  /** Inline: blurred teaser + light CTA (e.g. step-level detail). Default: full overlay. */
  variant?: "default" | "inline";
  inlineLockedTitle?: string;
  inlineLockedDescription?: string;
  ctaLabel?: string;
  children: React.ReactNode;
};

export function PremiumGate({
  isPremium,
  userPlan,
  preview = true,
  variant = "default",
  inlineLockedTitle,
  inlineLockedDescription,
  ctaLabel,
  children,
}: PremiumGateProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const copy = locale === "en" ? enDict.paywall : frDict.paywall;
  const locked = isPremium && userPlan !== "premium";
  const buttonLabel = ctaLabel ?? copy.gateCta;

  if (!locked) {
    return <>{children}</>;
  }

  if (variant === "inline") {
    return (
      <>
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-border/40 bg-muted/15">
            <div
              className={cn(
                "max-h-48 overflow-hidden transition duration-300 ease-out motion-reduce:transition-none md:max-h-56",
                preview && "pointer-events-none select-none blur-[2px] opacity-65",
              )}
              aria-hidden="true"
            >
              {children}
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background from-40% via-background/70 to-transparent"
              aria-hidden
            />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 shadow-sm">
            {inlineLockedTitle ? (
              <p className="font-heading text-sm font-semibold leading-snug text-foreground">
                {inlineLockedTitle}
              </p>
            ) : null}
            {inlineLockedDescription ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {inlineLockedDescription}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="mt-3"
              onClick={() => setOpen(true)}
            >
              {buttonLabel}
            </Button>
          </div>
        </div>

        <PaywallModal open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <div className="group relative overflow-hidden rounded-xl">
        <div
          className={cn(
            "transition duration-300",
            preview && "pointer-events-none select-none blur-[2px] opacity-65",
          )}
          aria-hidden="true"
        >
          {children}
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/45 via-black/20 to-transparent p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/30 bg-black/40 p-4 text-center text-white backdrop-blur-sm transition duration-300 group-hover:scale-[1.01]">
            <p className="font-heading text-xl">{copy.gateTitle}</p>
            <p className="mt-1 text-sm text-white/85">{copy.gateBody}</p>
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={() => setOpen(true)}
            >
              {buttonLabel}
            </Button>
          </div>
        </div>
      </div>

      <PaywallModal open={open} onOpenChange={setOpen} />
    </>
  );
}
