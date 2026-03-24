"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { FavoritesAuthModal } from "@/components/shared/favorites-auth-modal";
import { FavoritesPremiumLimitModal } from "@/components/shared/favorites-premium-limit-modal";
import { SimpleToast } from "@/components/shared/simple-toast";
import { cn } from "@/lib/utils";
import { toggleSoilFavoriteAction } from "../actions/soil-favorite-actions";

export type SoilFavoriteLabels = {
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
  soilId: string;
  soilSlug: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  labels: SoilFavoriteLabels;
};

export function SoilFavoriteButton({
  soilId,
  soilSlug,
  initialFavorited,
  isLoggedIn,
  labels,
}: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [authOpen, setAuthOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const returnPath = useMemo(
    () => `/sols/${encodeURIComponent(soilSlug)}`,
    [soilSlug],
  );
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
      const result = await toggleSoilFavoriteAction(soilId, soilSlug);
      if (!result.ok) {
        setFavorited((value) => !value);
        if (result.code === "limit_reached") {
          setPremiumOpen(true);
        }
        return;
      }

      setFavorited(result.favorited);
      setToast(result.favorited ? labels.addedToast : labels.removedToast);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "rounded-full p-1 text-wine transition-transform duration-200 hover:scale-110",
          "focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:outline-none",
          isPending && "pointer-events-none opacity-70",
        )}
        aria-label={favorited ? labels.unfavoriteAria : labels.favoriteAria}
        aria-pressed={favorited}
      >
        <Star
          className={cn(
            "h-5 w-5 transition-colors duration-200",
            favorited ? "fill-wine stroke-wine" : "fill-transparent stroke-wine",
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
