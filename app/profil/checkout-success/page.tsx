"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function normalizeReturnPath(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = useMemo(
    () => normalizeReturnPath(searchParams.get("return_to")),
    [searchParams],
  );
  const synced = searchParams.get("synced") === "1";
  const syncError = searchParams.get("sync_error");

  useEffect(() => {
    if (!synced) return;
    const timer = window.setTimeout(() => {
      router.replace(returnTo);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [router, returnTo, synced]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-wine/20 bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Payment confirmed
        </p>
        <h1 className="mt-2 font-heading text-3xl text-wine">Merci, vous etes Premium.</h1>
        {synced ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Votre abonnement est active. Redirection en cours...
          </p>
        ) : null}
        {!synced ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-800">
            <p>Activation Premium partielle.</p>
            <p className="mt-1 text-xs opacity-80">
              Code: {syncError ?? "UNKNOWN"} | Ouvre les logs Vercel:
              &nbsp;`[billing][checkout-finalize]`.
            </p>
          </div>
        ) : null}
        <Link
          href={returnTo}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Retourner a la page precedente
        </Link>
      </div>
    </div>
  );
}
