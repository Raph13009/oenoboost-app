"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import type { DictionaryTerm } from "../types";
import { dictionaryGroupKey } from "../utils";
import { DictionaryTermFavoriteButton } from "./dictionary-term-favorite-button";
import { cn } from "@/lib/utils";

type Props = {
  terms: DictionaryTerm[];
  locale: Locale;
  labels: Dictionary["dictionnaire"];
  /** Copy for favorite limit modal (shared with other modules). */
  favoritesLimit: Pick<
    Dictionary["favorites"],
    "premiumLimitTitle" | "premiumLimitBody" | "premiumLimitAck"
  >;
  favoritedIds: string[];
  isLoggedIn: boolean;
  userPremium: boolean;
};

const LIST_PAGE_SIZE = 20;

function sectionDomId(letter: string): string {
  return letter === "#" ? "dict-letter-hash" : `dict-letter-${letter}`;
}

export function DictionaryBrowser({
  terms,
  locale,
  labels,
  favoritesLimit,
  favoritedIds,
  isLoggedIn,
  userPremium,
}: Props) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => terms[0]?.id ?? null,
  );
  const detailRef = useRef<HTMLElement>(null);
  const skipDetailScrollRef = useRef(true);
  const favoritedSet = useMemo(
    () => new Set(favoritedIds),
    [favoritedIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter((t) => {
      const fr = t.term_fr.toLowerCase();
      const en = t.term_en.toLowerCase();
      return fr.includes(q) || en.includes(q);
    });
  }, [terms, query]);

  const isSearchMode = query.trim().length > 0;

  const effectiveSelectedId = useMemo(() => {
    if (filtered.length === 0) return null;
    if (selectedId && filtered.some((t) => t.id === selectedId)) {
      return selectedId;
    }
    return filtered[0].id;
  }, [filtered, selectedId]);

  /** Browsing: paginate by 20. Search: full result set. Selected term always stays in the list slice. */
  const listForGrouping = useMemo(() => {
    if (isSearchMode) return filtered;
    let end = visibleCount;
    if (effectiveSelectedId) {
      const idx = filtered.findIndex((t) => t.id === effectiveSelectedId);
      if (idx >= 0) end = Math.max(end, idx + 1);
    }
    return filtered.slice(0, Math.min(end, filtered.length));
  }, [filtered, visibleCount, isSearchMode, effectiveSelectedId]);

  const grouped = useMemo(() => {
    const map = new Map<string, DictionaryTerm[]>();
    for (const t of listForGrouping) {
      const key = dictionaryGroupKey(t.term_fr);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    const letters = [...map.keys()].sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b, locale === "en" ? "en" : "fr");
    });
    return { map, letters };
  }, [listForGrouping, locale]);

  const canShowMore =
    !isSearchMode && visibleCount < filtered.length;

  const selected = useMemo(() => {
    if (!effectiveSelectedId) return null;
    return filtered.find((t) => t.id === effectiveSelectedId) ?? null;
  }, [filtered, effectiveSelectedId]);

  useEffect(() => {
    if (skipDetailScrollRef.current) {
      skipDetailScrollRef.current = false;
      return;
    }
    if (!effectiveSelectedId || typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const id = window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [effectiveSelectedId]);

  const favoriteLabels = useMemo(
    () => ({
      favoriteAria: labels.favoriteAria,
      unfavoriteAria: labels.unfavoriteAria,
      addedToast: labels.favoriteAddedToast,
      removedToast: labels.favoriteRemovedToast,
      authModal: {
        title: labels.favoriteAuthTitle,
        body: labels.favoriteAuthBody,
        login: labels.favoriteAuthLogin,
        register: labels.favoriteAuthRegister,
      },
      premiumLimit: {
        title: favoritesLimit.premiumLimitTitle,
        body: favoritesLimit.premiumLimitBody,
        acknowledge: favoritesLimit.premiumLimitAck,
      },
    }),
    [labels, favoritesLimit],
  );

  const canRead = (t: DictionaryTerm) => !t.is_premium || userPremium;

  if (terms.length === 0) {
    return (
      <p className="text-[15px] text-muted-foreground">{labels.emptyList}</p>
    );
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
      <aside
        id="dictionary-list-top"
        className="flex w-full flex-col gap-4 md:sticky md:top-24 md:max-h-[calc(100vh-7rem)] md:w-[min(100%,20rem)] md:shrink-0"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (v.trim() === "") {
                setVisibleCount(LIST_PAGE_SIZE);
              }
            }}
            placeholder={labels.searchPlaceholder}
            className="border-border/80 bg-card/80 pl-9 font-sans text-[15px] placeholder:text-muted-foreground/70"
            aria-label={labels.searchPlaceholder}
          />
        </div>

        <div className="overflow-y-auto rounded-xl border border-border/50 bg-card/40 md:min-h-0 md:flex-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {labels.noSearchResults}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border/40 py-1">
                {grouped.letters.map((letter) => (
                  <li
                    key={letter}
                    id={sectionDomId(letter)}
                    className="scroll-mt-24"
                  >
                    <div className="bg-muted/30 px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {letter}
                    </div>
                    <ul>
                      {grouped.map.get(letter)?.map((t) => {
                        const isActive = t.id === effectiveSelectedId;
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(t.id)}
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] transition-colors",
                                isActive
                                  ? "bg-wine/10 text-foreground"
                                  : "text-foreground/90 hover:bg-muted/50",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate font-sans">
                                {getContent(t, "term", locale)}
                              </span>
                              {t.is_word_of_day ? (
                                <span className="shrink-0 rounded-full border border-wine/25 bg-wine/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-wine">
                                  {labels.wordOfDayBadge}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
              {canShowMore ? (
                <div className="border-t border-border/40 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((c) => c + LIST_PAGE_SIZE)
                    }
                    className="w-full rounded-lg border border-border/70 bg-card py-2.5 text-center text-sm font-medium text-wine transition-colors hover:border-wine/30 hover:bg-muted/40"
                  >
                    {labels.showMore}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

      </aside>

      <section
        ref={detailRef}
        id="dictionary-detail"
        className="min-w-0 flex-1 scroll-mt-8 border-t border-border/40 pt-6 md:border-t-0 md:pt-0"
      >
        {!selected ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {labels.selectTermHint}
          </p>
        ) : (
          <article className="flex flex-col gap-6">
            <header className="flex flex-col gap-3 border-b border-border/30 pb-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-wine md:text-3xl">
                  {getContent(selected, "term", locale)}
                </h2>
                <DictionaryTermFavoriteButton
                  termId={selected.id}
                  initialFavorited={favoritedSet.has(selected.id)}
                  isLoggedIn={isLoggedIn}
                  labels={favoriteLabels}
                />
              </div>
            </header>

            {canRead(selected) ? (
              <>
                <div className="max-w-none font-sans text-[15px] leading-[1.75] text-foreground/95">
                  <p className="whitespace-pre-line">
                    {getContent(selected, "definition", locale)}
                  </p>
                </div>

                {getContent(selected, "examples", locale).trim() ? (
                  <div>
                    <h3 className="mb-2 font-heading text-lg text-foreground">
                      {labels.examplesTitle}
                    </h3>
                    <p className="whitespace-pre-line font-sans text-[15px] leading-relaxed text-foreground/90">
                      {getContent(selected, "examples", locale)}
                    </p>
                  </div>
                ) : null}

                {getContent(selected, "etymology", locale).trim() ? (
                  <div>
                    <h3 className="mb-2 font-heading text-lg text-foreground">
                      {labels.etymologyTitle}
                    </h3>
                    <p className="whitespace-pre-line font-sans text-[15px] leading-relaxed text-muted-foreground">
                      {getContent(selected, "etymology", locale)}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-6">
                <p className="font-heading text-lg text-foreground">
                  {labels.premiumLockedTitle}
                </p>
                <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted-foreground">
                  {labels.premiumLockedBody}
                </p>
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  );
}
