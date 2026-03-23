"use client";

import Link from "next/link";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="pr-8">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="mt-3">{copy.body}</DialogDescription>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Link
            href={loginHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full sm:w-auto",
            )}
          >
            {copy.login}
          </Link>
          <Link
            href={registerHref}
            className={cn(buttonVariants(), "w-full sm:w-auto")}
          >
            {copy.register}
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
