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
import { signUpAction } from "@/features/auth/actions";
import { getSafeRedirectPath } from "@/lib/auth/safe-redirect-path";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const dict = locale === "en" ? enDict : frDict;

  const afterAuthPath = useMemo(
    () => getSafeRedirectPath(searchParams.get("next")),
    [searchParams],
  );
  const loginHref = useMemo(() => {
    if (!afterAuthPath) return "/login";
    return `/login?next=${encodeURIComponent(afterAuthPath)}`;
  }, [afterAuthPath]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Use FormData to read the actual current input values.
    // This makes signup resilient to browser/extension autofill that might
    // not trigger React `onChange` for controlled inputs.
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const firstNameValue = String(fd.get("firstName") ?? "");
    const lastNameValue = String(fd.get("lastName") ?? "");
    const emailValue = String(fd.get("email") ?? "");
    const passwordValue = String(fd.get("password") ?? "");
    const confirmPasswordValue = String(fd.get("confirmPassword") ?? "");

    if (passwordValue !== confirmPasswordValue) {
      setError(dict.auth.passwordsDoNotMatch);
      setLoading(false);
      return;
    }

    const res = await signUpAction({
      firstName: firstNameValue,
      lastName: lastNameValue,
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{dict.auth.firstName}</Label>
          <Input
            id="firstName"
            name="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{dict.auth.lastName}</Label>
          <Input
            id="lastName"
            name="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>
      </div>

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
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{dict.auth.confirmPassword}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={loading} className="mt-2 w-full">
        {loading ? dict.common.loading : dict.auth.registerButton}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.hasAccount}{" "}
        <Link href={loginHref} className="font-medium text-wine hover:underline">
          {dict.auth.loginButton}
        </Link>
      </p>
    </form>
  );
}
