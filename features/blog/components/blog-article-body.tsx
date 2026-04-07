"use client";

import { PremiumGate } from "@/components/shared/premium-gate";

const PROSE_CLASS =
  "space-y-4 [&_a]:text-wine [&_a]:underline [&_a]:underline-offset-4 [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:font-heading [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-[15px] [&_p]:leading-relaxed [&_strong]:font-semibold";

type Props = {
  html: string;
  isPremium: boolean;
  userPlan: "free" | "premium";
  lockedTitle: string;
  lockedBody: string;
};

export function BlogArticleBody({
  html,
  isPremium,
  userPlan,
  lockedTitle,
  lockedBody,
}: Props) {
  const body = (
    <div
      className={PROSE_CLASS}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );

  return (
    <PremiumGate
      isPremium={isPremium}
      userPlan={userPlan}
      variant="inline"
      inlineLockedTitle={lockedTitle}
      inlineLockedDescription={lockedBody}
    >
      {body}
    </PremiumGate>
  );
}
