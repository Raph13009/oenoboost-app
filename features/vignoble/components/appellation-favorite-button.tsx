"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Star } from "lucide-react";

import { FavoritesAuthModal } from "@/components/shared/favorites-auth-modal";
import { FavoritesPremiumLimitModal } from "@/components/shared/favorites-premium-limit-modal";
import { SimpleToast } from "@/components/shared/simple-toast";
import { toggleAppellationFavoriteAction } from "@/features/vignoble/actions/appellation-favorite-actions";
import { cn } from "@/lib/utils";

export type AppellationFavoriteLabels = {
  favoriteAria: string;
  unfavoriteAria: string;
  addedToast: string;
  removedToast: string;
  authModal: {
    title: string;
    body: string;
    login: string;
    register: string;
  };
  premiumLimit: {
    title: string;
    body: string;
    acknowledge: string;
  };
};

type Props = {
  appellationId: string;
  regionSlug: string;
  aopSlug: string;
  subregionSlug: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  labels: AppellationFavoriteLabels;
  size?: "default" | "sm";
};

export function AppellationFavoriteButton({
  appellationId,
  regionSlug,
  aopSlug,
  subregionSlug,
  initialFavorited,
  isLoggedIn,
  labels,
  size = "default",
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [authOpen, setAuthOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const returnPath = useMemo(() => {
    const q = new URLSearchParams({ subregion: subregionSlug });
    return `/vignoble/${regionSlug}/${aopSlug}?${q.toString()}`;
  }, [regionSlug, aopSlug, subregionSlug]);

  const loginHref = useMemo(
    () => `/login?next=${encodeURIComponent(returnPath)}`,
    [returnPath],
  );
  const registerHref = useMemo(
    () => `/signup?next=${encodeURIComponent(returnPath)}`,
    [returnPath],
  );

  useEffect(() => {
    setFavorited(initialFavorited);
  }, [initialFavorited]);

  const handleClick = () => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }

    const next = !favorited;
    setFavorited(next);

    startTransition(async () => {
      const res = await toggleAppellationFavoriteAction(
        appellationId,
        regionSlug,
        aopSlug,
        subregionSlug,
      );
      if (!res.ok) {
        setFavorited((v) => !v);
        if (res.code === "limit_reached") {
          setPremiumOpen(true);
        }
        return;
      }
      setFavorited(res.favorited);
      setToast(res.favorited ? labels.addedToast : labels.removedToast);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "rounded-full text-wine transition-transform duration-200 hover:scale-110",
          size === "sm" ? "p-0.5" : "p-1",
          "focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:outline-none",
          isPending && "pointer-events-none opacity-70",
        )}
        aria-label={favorited ? labels.unfavoriteAria : labels.favoriteAria}
        aria-pressed={favorited}
      >
        <Star
          className={cn(
            "transition-colors duration-200",
            size === "sm" ? "h-4 w-4" : "h-5 w-5",
            favorited
              ? "fill-wine stroke-wine"
              : "fill-transparent stroke-wine",
          )}
          strokeWidth={1.6}
        />
      </button>

      <FavoritesAuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        copy={labels.authModal}
        loginHref={loginHref}
        registerHref={registerHref}
      />

      <FavoritesPremiumLimitModal
        open={premiumOpen}
        onOpenChange={setPremiumOpen}
        copy={labels.premiumLimit}
      />

      <SimpleToast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
