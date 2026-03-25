"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLocale } from "@/lib/i18n/locale-context";
import { LocaleSwitcher } from "./locale-switcher";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import frDict from "@/lib/i18n/dictionaries/fr";
import enDict from "@/lib/i18n/dictionaries/en";
import type { CurrentUser } from "@/lib/auth/session";
import { signOutAction } from "@/features/auth/actions";

const NAV_ITEMS: { key: keyof Dictionary["nav"]; href: string }[] = [
  { key: "vignoble", href: "/vignoble" },
  { key: "cepages", href: "/cepages" },
  { key: "sols", href: "/sols" },
  { key: "vinification", href: "/vinification" },
  { key: "dictionnaire", href: "/dictionnaire" },
  { key: "degustation", href: "/degustation" },
  { key: "quiz", href: "/quiz" },
];

type MobileMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CurrentUser | null;
};

export function MobileMenu({ open, onOpenChange, user }: MobileMenuProps) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const dict = locale === "en" ? enDict : frDict;
  const isAopRoute = pathname.startsWith("/vignoble/aop");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-72 bg-cream">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="font-heading text-xl text-wine">
            OenoBoost
          </SheetTitle>
        </SheetHeader>

        <nav className="mt-6 flex flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ key, href }) => {
            const isActive =
              href === "/vignoble"
                ? pathname.startsWith(href) && !isAopRoute
                : pathname.startsWith(href);
            return (
              <Link
                key={key}
                href={href}
                onClick={() => onOpenChange(false)}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-wine"
                    : "text-foreground hover:bg-accent hover:text-wine"
                }`}
              >
                {dict.nav[key]}
              </Link>
            );
          })}
          <Link
            href="/vignoble/aop"
            onClick={() => onOpenChange(false)}
            className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              isAopRoute
                ? "bg-accent text-wine"
                : "text-foreground hover:bg-accent hover:text-wine"
            }`}
          >
            AOP
          </Link>
        </nav>

        <div className="mt-8 border-t border-border px-2 pt-5">
          {!user ? (
            <div className="flex flex-col gap-1">
              <Link
                href="/signup"
                onClick={() => onOpenChange(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium transition-colors text-foreground hover:bg-accent hover:text-wine"
              >
                {dict.auth.registerButton}
              </Link>
              <Link
                href="/login"
                onClick={() => onOpenChange(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium transition-colors text-foreground hover:bg-accent hover:text-wine"
              >
                {dict.auth.login}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Link
                href="/profil"
                onClick={() => onOpenChange(false)}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  pathname.startsWith("/profil")
                    ? "bg-accent text-wine"
                    : "text-foreground hover:bg-accent hover:text-wine"
                }`}
              >
                {dict.nav.profil}
              </Link>

              <form
                action={signOutAction}
                onSubmit={() => onOpenChange(false)}
              >
                <button
                  type="submit"
                  className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-wine"
                >
                  {dict.profile.logout}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-border px-6 pt-6">
          <LocaleSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
