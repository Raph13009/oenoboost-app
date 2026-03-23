"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/i18n/locale-context";
import frDict from "@/lib/i18n/dictionaries/fr";
import enDict from "@/lib/i18n/dictionaries/en";
import { signUpAction } from "@/features/auth/actions";

export function RegisterForm() {
  const router = useRouter();
  const { locale } = useLocale();
  const dict = locale === "en" ? enDict : frDict;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    router.push("/");
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

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={loading} className="mt-2 w-full">
        {loading ? dict.common.loading : dict.auth.registerButton}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {dict.auth.hasAccount}{" "}
        <Link href="/login" className="font-medium text-wine hover:underline">
          {dict.auth.loginButton}
        </Link>
      </p>
    </form>
  );
}
