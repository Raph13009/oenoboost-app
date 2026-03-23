"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Star } from "lucide-react";

import { FavoritesAuthModal } from "@/components/shared/favorites-auth-modal";
import { FavoritesPremiumLimitModal } from "@/components/shared/favorites-premium-limit-modal";
import { SimpleToast } from "@/components/shared/simple-toast";
import { toggleGrapeFavoriteAction } from "@/features/cepages/actions/grape-favorite-actions";
import { cn } from "@/lib/utils";

export type GrapeFavoriteLabels = {
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
  grapeId: string;
  grapeSlug: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  labels: GrapeFavoriteLabels;
  /** Liste cépages : étoile plus petite */
  size?: "default" | "sm";
};

export function GrapeFavoriteButton({
  grapeId,
  grapeSlug,
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

  const returnPath = useMemo(
    () => `/cepages/${encodeURIComponent(grapeSlug)}`,
    [grapeSlug],
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
      const res = await toggleGrapeFavoriteAction(grapeId, grapeSlug);
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
