"use client";

import Link from "next/link";
import { useEffect } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type FavoritesAuthModalCopy = {
  title: string;
  body: string;
  login: string;
  register: string;
  back?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: FavoritesAuthModalCopy;
  loginHref: string;
  registerHref: string;
};

export function FavoritesAuthModal({
  open,
  onOpenChange,
  copy,
  loginHref,
  registerHref,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const body = document.body;
    const main = document.getElementById("app-main");
    const preventScroll = (event: Event) => {
      event.preventDefault();
    };

    html.classList.add("quiz-scroll-lock");
    body.classList.add("quiz-scroll-lock");
    main?.classList.add("quiz-scroll-lock");
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      html.classList.remove("quiz-scroll-lock");
      body.classList.remove("quiz-scroll-lock");
      main?.classList.remove("quiz-scroll-lock");
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="pr-8">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="mt-3">{copy.body}</DialogDescription>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <Link
            href={loginHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full",
            )}
          >
            {copy.login}
          </Link>
          <Link
            href={registerHref}
            className={cn(buttonVariants(), "w-full")}
          >
            {copy.register}
          </Link>
          {copy.back ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(buttonVariants({ variant: "ghost" }), "w-full")}
            >
              {copy.back}
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
