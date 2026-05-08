"use client";

import type { AopListItem } from "../layers/use-aop-layer";

type AopListPanelProps = {
  items: AopListItem[];
  onPick: (id: number, name: string) => void;
};

export function AopListPanel({ items, onPick }: AopListPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card md:h-auto md:max-h-[min(60vh,520px)] md:w-56 md:border-border/60 md:bg-card/95 md:shadow-sm md:backdrop-blur-[2px]">
      <div className="overflow-y-auto p-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id, item.name)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.colorHex }}
            />
            <span className="truncate text-[13px] font-medium leading-snug">
              {item.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
