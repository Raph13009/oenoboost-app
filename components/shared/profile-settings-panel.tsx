"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOutAction } from "@/features/auth/actions";

export type ProfileSettingsCopy = {
  settings: string;
  logout: string;
  deleteAccount: string;
  deleteDialogTitle: string;
  deleteDialogBody: string;
  deleteDialogAck: string;
};

type Props = {
  copy: ProfileSettingsCopy;
  deleteContactEmail: string;
};

export function ProfileSettingsPanel({ copy, deleteContactEmail }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const bodyWithEmail = copy.deleteDialogBody.replace(
    "{{email}}",
    deleteContactEmail,
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full border-border/60 text-foreground"
        onClick={() => setSettingsOpen(true)}
      >
        {copy.settings}
      </Button>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{copy.settings}</DialogTitle>
          <div className="flex flex-col gap-3 pt-1">
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="w-full border-border text-foreground hover:bg-muted/40"
              >
                {copy.logout}
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start px-2 py-2 text-sm font-normal text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSettingsOpen(false);
                setDeleteOpen(true);
              }}
            >
              {copy.deleteAccount}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{copy.deleteDialogTitle}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-foreground/90">
            {bodyWithEmail}
          </DialogDescription>
          <Button
            type="button"
            className="mt-2 w-full"
            onClick={() => setDeleteOpen(false)}
          >
            {copy.deleteDialogAck}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
