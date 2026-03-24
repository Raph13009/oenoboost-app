"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Star } from "lucide-react";

import { FavoritesAuthModal } from "@/components/shared/favorites-auth-modal";
import { FavoritesPremiumLimitModal } from "@/components/shared/favorites-premium-limit-modal";
import { SimpleToast } from "@/components/shared/simple-toast";
import { toggleDictionaryFavoriteAction } from "@/features/dictionnaire/actions/dictionary-favorite-actions";
import { cn } from "@/lib/utils";
import type { FavoritesPremiumLimitCopy } from "@/components/shared/favorites-premium-limit-modal";
import type { FavoritesAuthModalCopy } from "@/components/shared/favorites-auth-modal";

export type DictionaryFavoriteLabels = {
  favoriteAria: string;
  unfavoriteAria: string;
  addedToast: string;
  removedToast: string;
  authModal: FavoritesAuthModalCopy;
  premiumLimit: FavoritesPremiumLimitCopy;
};

type Props = {
  termId: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  labels: DictionaryFavoriteLabels;
};

export function DictionaryTermFavoriteButton({
  termId,
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
    () => `/dictionnaire`,
    [],
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

    setFavorited((v) => !v);

    startTransition(async () => {
      const res = await toggleDictionaryFavoriteAction(termId);
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
