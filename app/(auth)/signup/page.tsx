import { RegisterForm } from "@/features/auth/components/register-form";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export default async function SignupPage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-semibold">
          {dict.auth.createAccountTitle}
        </h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <RegisterForm />
      </div>
    </div>
  );
}
