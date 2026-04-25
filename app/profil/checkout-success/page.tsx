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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(returnTo);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [router, returnTo]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-wine/20 bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Payment confirmed
        </p>
        <h1 className="mt-2 font-heading text-3xl text-wine">Merci, vous etes Premium.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Votre abonnement est active. Redirection en cours...
        </p>
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
