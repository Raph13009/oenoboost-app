"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type FavoritesPremiumLimitCopy = {
  title: string;
  body: string;
  acknowledge: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: FavoritesPremiumLimitCopy;
};

export function FavoritesPremiumLimitModal({
  open,
  onOpenChange,
  copy,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription className="whitespace-pre-line text-foreground/90">
          {copy.body}
        </DialogDescription>
        <Button
          type="button"
          className="mt-2 w-full"
          onClick={() => onOpenChange(false)}
        >
          {copy.acknowledge}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
