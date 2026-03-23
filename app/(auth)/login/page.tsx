import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata = {
  title: "Connexion — OenoBoost",
};

export default async function LoginPage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-semibold">
          {dict.auth.login}
        </h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <Suspense fallback={<div className="min-h-[240px]" aria-hidden />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
