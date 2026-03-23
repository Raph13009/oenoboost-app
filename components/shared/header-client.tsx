"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

import { MobileMenu } from "./mobile-menu";
import type { CurrentUser } from "@/lib/auth/session";
import { LocaleProvider } from "@/lib/i18n/locale-context";

export function HeaderClient({ user }: { user: CurrentUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <LocaleProvider>
      <>
        <header className="sticky top-0 z-40 border-b border-border bg-cream/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6 md:px-12">
            <Link
              href="/"
              className="font-heading text-xl tracking-wide text-wine"
            >
              OenoBoost
            </Link>

            <button
              onClick={() => setMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-accent"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} user={user} />
      </>
    </LocaleProvider>
  );
}
