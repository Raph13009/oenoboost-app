"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPremiumCheckoutSession } from "@/features/billing/actions/billing-actions";
import enDict from "@/lib/i18n/dictionaries/en";
import frDict from "@/lib/i18n/dictionaries/fr";
import { useLocale } from "@/lib/i18n/locale-context";

import { SimpleToast } from "./simple-toast";

type PaywallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FEATURE_ICONS = ["🍷", "🗺️", "🧠", "📖", "🧪", "⭐"] as const;

export function PaywallModal({ open, onOpenChange }: PaywallModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const copy = locale === "en" ? enDict.paywall : frDict.paywall;
  const common = locale === "en" ? enDict.common : frDict.common;

  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const features = [
    copy.featureAop,
    copy.featureMap,
    copy.featureQuiz,
    copy.featureDictionary,
    copy.featureTasting,
    copy.featureFavorites,
  ] as const;

  const handleUpgrade = useCallback(() => {
    startTransition(async () => {
      const result = await createPremiumCheckoutSession();
      if (result.ok) {
        window.location.assign(result.url);
        return;
      }
      switch (result.code) {
        case "AUTH_REQUIRED": {
          const next = encodeURIComponent(pathname || "/");
          router.push(`/login?next=${next}`);
          setToast(copy.checkoutLoginRequired);
          break;
        }
        case "ALREADY_PREMIUM":
          setToast(copy.checkoutAlreadyPremium);
          onOpenChange(false);
          break;
        case "CONFIG":
          setToast(copy.checkoutConfig);
          break;
        default:
          setToast(copy.checkoutError);
      }
    });
  }, [copy, onOpenChange, pathname, router]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto sm:max-w-lg">
          <div className="text-left">
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription className="mt-1">{copy.intro}</DialogDescription>

            <div className="paywall-modal-enter mt-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              <ul className="flex flex-col gap-y-3 text-left text-sm">
                {features.map((title, i) => (
                  <li key={title} className="flex gap-3">
                    <span
                      className="shrink-0 pt-0.5 text-base leading-none"
                      aria-hidden
                    >
                      {FEATURE_ICONS[i]}
                    </span>
                    <span className="min-w-0 flex-1 font-medium leading-snug text-foreground">
                      {title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-wine/25 bg-wine/5 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {copy.premiumLabel}
              </p>
              <p className="mt-1 font-heading text-2xl text-wine">
                {copy.priceLine}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.cancelAnytime}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="w-full"
                disabled={isPending}
                onClick={handleUpgrade}
              >
                {isPending ? common.loading : copy.upgrade}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isPending}
                onClick={() => onOpenChange(false)}
              >
                {copy.continueFree}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SimpleToast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
