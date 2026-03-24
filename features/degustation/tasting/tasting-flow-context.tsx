"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  STORAGE_KEY,
  createEmptyTastingDraft,
  type TastingDraft,
} from "@/features/degustation/tasting/tasting-draft";

type Ctx = {
  draft: TastingDraft;
  setDraft: React.Dispatch<React.SetStateAction<TastingDraft>>;
  patch: (partial: Partial<TastingDraft>) => void;
  reset: () => void;
};

const TastingFlowContext = createContext<Ctx | null>(null);

function loadDraft(): TastingDraft {
  if (typeof window === "undefined") return createEmptyTastingDraft();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyTastingDraft();
    const parsed = JSON.parse(raw) as Partial<TastingDraft>;
    const base = createEmptyTastingDraft();
    return { ...base, ...parsed, nose_aroma_families: parsed.nose_aroma_families ?? [] };
  } catch {
    return createEmptyTastingDraft();
  }
}

export function TastingFlowProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<TastingDraft>(createEmptyTastingDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDraft(loadDraft());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore quota */
    }
  }, [draft, hydrated]);

  const patch = useCallback((partial: Partial<TastingDraft>) => {
    setDraft((d) => ({ ...d, ...partial }));
  }, []);

  const reset = useCallback(() => {
    const empty = createEmptyTastingDraft();
    setDraft(empty);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft, patch, reset }),
    [draft, patch, reset],
  );

  return (
    <TastingFlowContext.Provider value={value}>
      {children}
    </TastingFlowContext.Provider>
  );
}

export function useTastingFlow() {
  const ctx = useContext(TastingFlowContext);
  if (!ctx) {
    throw new Error("useTastingFlow must be used within TastingFlowProvider");
  }
  return ctx;
}
