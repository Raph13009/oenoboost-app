import Link from "next/link";
import { History, Star } from "lucide-react";

import { ProfileSettingsPanel } from "@/components/shared/profile-settings-panel";
import { getLevelProgress } from "@/features/gamification/levels";
import { requireUser } from "@/lib/auth/session";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";

function getInitials(firstName: string | null, lastName: string | null) {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "U";
}

export default async function ProfilePage() {
  const user = await requireUser();
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const initials = getInitials(user.first_name, user.last_name);
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const progression = getLevelProgress(user.xp);

  const deleteContactEmail =
    process.env.NEXT_PUBLIC_ACCOUNT_DELETE_EMAIL ?? "support@oenoboost.com";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          {dict.nav.profil}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {dict.profile.plan}: {user.plan}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-wine text-white">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="Avatar"
                src={user.avatar_url}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-heading text-xl font-semibold">
                {initials}
              </span>
            )}
          </div>

          <div className="flex-1">
            <div className="font-heading text-2xl font-semibold">
              {fullName || user.email}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {user.email}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="font-medium text-foreground">
                  {dict.profile.plan}
                </span>
                <div className="text-muted-foreground">{user.plan}</div>
              </div>
              <div>
                <span className="font-medium text-foreground">
                  {dict.profile.level}
                </span>
                <div className="text-muted-foreground">
                  {dict.profile.levelLabel.replace("{level}", String(progression.level))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border/50 pt-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {dict.profile.progression}
            </p>
            <div className="font-heading text-3xl font-semibold text-wine">
              {dict.profile.levelLabel.replace("{level}", String(progression.level))}
            </div>
            <p className="text-sm text-muted-foreground">
              {progression.isMaxLevel
                ? dict.profile.maxLevelXp.replace(
                    "{xp}",
                    String(progression.currentXp),
                  )
                : dict.profile.currentXp
                    .replace("{xp}", String(progression.currentXp))
                    .replace("{next}", String(progression.nextLevelMinXp))}
            </p>
          </div>

          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-wine transition-[width] duration-500 ease-out"
                style={{ width: `${progression.progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>{progression.currentLevelMinXp} XP</span>
              <span>
                {progression.isMaxLevel
                  ? dict.profile.max
                  : `${progression.nextLevelMinXp} XP`}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/profil/favoris"
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-muted hover:text-foreground"
          >
            <Star
              className="h-4 w-4 shrink-0 fill-wine stroke-wine"
              strokeWidth={1.6}
            />
            {dict.nav.myFavorites}
          </Link>

          <Link
            href="/degustation/history"
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 hover:bg-muted hover:text-foreground"
          >
            <History className="h-4 w-4 shrink-0 text-wine" strokeWidth={1.6} />
            {dict.tastingHistory.title}
          </Link>

          <button
            type="button"
            disabled
            className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-border/50 bg-muted/30 px-2.5 text-sm font-medium text-muted-foreground opacity-70"
          >
            {dict.profile.subscription}
          </button>

          <ProfileSettingsPanel
            deleteContactEmail={deleteContactEmail}
            copy={{
              settings: dict.profile.settings,
              logout: dict.profile.logout,
              deleteAccount: dict.profile.deleteAccount,
              deleteDialogTitle: dict.profile.deleteAccountTitle,
              deleteDialogBody: dict.profile.deleteAccountBody,
              deleteDialogAck: dict.profile.deleteAccountAck,
            }}
          />
        </div>
      </div>
    </div>
  );
}
