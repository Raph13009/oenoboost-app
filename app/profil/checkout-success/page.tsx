"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [syncState, setSyncState] = useState<"syncing" | "ok" | "error">("syncing");
  const [syncCode, setSyncCode] = useState<string | null>(null);

  const returnTo = useMemo(
    () => normalizeReturnPath(searchParams.get("return_to")),
    [searchParams],
  );
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      console.info("[checkout-success] start premium activation", {
        sessionId: sessionId ?? null,
        returnTo,
      });
      // Hard requirement: when success page is shown, force users.plan='premium'.
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const response = await fetch("/api/billing/force-premium", { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (cancelled) return;
        console.info("[checkout-success] force-premium attempt result", {
          attempt,
          httpStatus: response.status,
          result,
        });
        if (response.ok && result.ok) {
          setSyncState("ok");
          setSyncCode(null);
          // Keep subscriptions table best-effort sync in background for consistency.
          void fetch("/api/billing/checkout-sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId }),
          })
            .then(async (res) => {
              const payload = await res.json().catch(() => ({}));
              console.info("[checkout-success] checkout-sync background result", {
                httpStatus: res.status,
                payload,
              });
            })
            .catch((error) => {
              console.warn("[checkout-success] checkout-sync background failed", {
                error,
              });
            });
          return;
        }
        setSyncCode(result.code ?? `HTTP_${response.status}`);
        if (attempt < 4) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt * 700));
        }
      }
      setSyncState("error");
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, returnTo]);

  useEffect(() => {
    if (syncState !== "ok") return;
    const timer = window.setTimeout(() => {
      router.replace(returnTo);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [router, returnTo, syncState]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-wine/20 bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Payment confirmed
        </p>
        <h1 className="mt-2 font-heading text-3xl text-wine">Merci, vous etes Premium.</h1>
        {syncState === "syncing" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Synchronisation de votre abonnement en cours...
          </p>
        ) : null}
        {syncState === "ok" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Votre abonnement est active. Redirection en cours...
          </p>
        ) : null}
        {syncState === "error" ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-800">
            <p>L&apos;activation Premium a echoue.</p>
            <p className="mt-1 text-xs opacity-80">
              Code: {syncCode ?? "unknown"} | Ouvre les logs Vercel:
              &nbsp;`[billing][force-premium]`.
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
