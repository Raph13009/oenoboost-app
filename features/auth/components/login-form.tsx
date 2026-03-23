"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/i18n/locale-context";
import frDict from "@/lib/i18n/dictionaries/fr";
import enDict from "@/lib/i18n/dictionaries/en";
import { signInAction } from "@/features/auth/actions";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect-path";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const dict = locale === "en" ? enDict : frDict;

  const afterAuthPath = useMemo(
    () => getSafeRedirectPath(searchParams.get("next")),
    [searchParams],
  );
  const signupHref = useMemo(() => {
    if (!afterAuthPath) return "/signup";
    return `/signup?next=${encodeURIComponent(afterAuthPath)}`;
  }, [afterAuthPath]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Read from FormData so browser autofill always matches server-side values.
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const emailValue = String(fd.get("email") ?? "");
    const passwordValue = String(fd.get("password") ?? "");

    const res = await signInAction({
      email: emailValue,
      password: passwordValue,
      locale,
    });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }

    router.push(afterAuthPath ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="email">{dict.auth.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{dict.auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={loading} className="mt-2 w-full">
        {loading ? dict.common.loading : dict.auth.loginButton}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.noAccount}{" "}
        <Link href={signupHref} className="font-medium text-wine hover:underline">
          {dict.auth.registerButton}
        </Link>
      </p>
    </form>
  );
}
