"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import type { RefObject } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type { VinificationStep } from "../types";
import { cn } from "@/lib/utils";

type VinificationTimelineLabels = {
  expand: string;
  collapse: string;
};

type VinificationTimelineProps = {
  steps: VinificationStep[];
  locale: Locale;
  labels: VinificationTimelineLabels;
};

type DotProps = { active: boolean };

const TimelineDot = forwardRef<HTMLSpanElement, DotProps>(
  function TimelineDot({ active }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "box-border block shrink-0 rounded-full border-2 border-wine/45 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-300",
          "h-3.5 w-3.5 md:h-4 md:w-4",
          active
            ? "border-wine bg-wine/25 shadow-[0_2px_8px_rgba(124,39,54,0.35)] ring-[3px] ring-wine/35"
            : "ring-0 ring-transparent",
        )}
        aria-hidden
      />
    );
  },
);

type StepCardProps = {
  step: VinificationStep;
  index: number;
  locale: Locale;
  labels: VinificationTimelineLabels;
  open: boolean;
  onToggle: () => void;
};

function StepCard({
  step,
  index,
  locale,
  labels,
  open,
  onToggle,
}: StepCardProps) {
  const title = getContent(step, "title", locale);
  const summary = getContent(step, "summary", locale);
  const detail = getContent(step, "detail", locale);
  const hasDetail = detail.trim().length > 0;

  const num = String(index + 1).padStart(2, "0");

  const headerRow = (
    <div className="flex items-start gap-3">
      <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground/80">
        {num}
      </span>
      {step.icon_url ? (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted/20">
          <Image
            src={step.icon_url}
            alt=""
            fill
            sizes="36px"
            className="object-contain p-1"
          />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="font-heading text-lg font-semibold leading-snug text-foreground md:text-xl">
          {title}
        </h3>
        {summary ? (
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            {summary}
          </p>
        ) : null}
      </div>
      {hasDetail ? (
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
          aria-hidden
        />
      ) : null}
    </div>
  );

  const detailBlock = hasDetail ? (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "border-t border-border/40 pt-4 text-[15px] leading-relaxed text-foreground/85 transition-opacity duration-300 ease-out motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="whitespace-pre-line">{detail}</p>
        </div>
      </div>
    </div>
  ) : null;

  const shellClass = cn(
    "rounded-xl border border-border/80 bg-card/90 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out motion-reduce:transition-none",
    "hover:-translate-y-0.5 hover:border-wine/15 hover:shadow-[0_14px_40px_-14px_rgba(0,0,0,0.18)]",
    open &&
      "border-wine/20 bg-card shadow-[0_16px_44px_-16px_rgba(124,39,54,0.12)]",
  );

  if (!hasDetail) {
    return (
      <div className={shellClass}>
        <div className="p-5">
          {headerRow}
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-xl p-5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-wine/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={open}
        aria-label={open ? labels.collapse : labels.expand}
      >
        {headerRow}
        {detailBlock}
      </button>
    </div>
  );
}

function assignDotPairRef(
  index: number,
  total: number,
  first: RefObject<HTMLSpanElement | null>,
  last: RefObject<HTMLSpanElement | null>,
): React.Ref<HTMLSpanElement> | undefined {
  if (total <= 0) return undefined;
  if (total === 1 && index === 0) {
    return (el) => {
      first.current = el;
      last.current = el;
    };
  }
  if (index === 0) return first;
  if (index === total - 1) return last;
  return undefined;
}

function measureTimelineSegment(
  container: HTMLDivElement | null,
  first: HTMLSpanElement | null,
  last: HTMLSpanElement | null,
): { top: number; height: number } | null {
  if (!container || !first || !last) return null;
  if (window.getComputedStyle(container).display === "none") return null;
  const c = container.getBoundingClientRect();
  const fr = first.getBoundingClientRect();
  const lr = last.getBoundingClientRect();
  const top = fr.top + fr.height / 2 - c.top;
  const bottom = lr.top + lr.height / 2 - c.top;
  const height = Math.max(0, bottom - top);
  return { top, height };
}

export function VinificationTimeline({
  steps,
  locale,
  labels,
}: VinificationTimelineProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const mobileFirstDotRef = useRef<HTMLSpanElement>(null);
  const mobileLastDotRef = useRef<HTMLSpanElement>(null);
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const desktopFirstDotRef = useRef<HTMLSpanElement>(null);
  const desktopLastDotRef = useRef<HTMLSpanElement>(null);

  const [mobileLine, setMobileLine] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const [desktopLine, setDesktopLine] = useState<{
    top: number;
    height: number;
  } | null>(null);

  const setItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current[id] = el;
    else delete itemRefs.current[id];
  }, []);

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!openId) return;
    const el = itemRefs.current[openId];
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [openId]);

  const measureLines = useCallback(() => {
    setMobileLine(
      measureTimelineSegment(
        mobileContainerRef.current,
        mobileFirstDotRef.current,
        mobileLastDotRef.current,
      ),
    );
    setDesktopLine(
      measureTimelineSegment(
        desktopContainerRef.current,
        desktopFirstDotRef.current,
        desktopLastDotRef.current,
      ),
    );
  }, []);

  useLayoutEffect(() => {
    measureLines();
    const ro = new ResizeObserver(() => measureLines());
    const m = mobileContainerRef.current;
    const d = desktopContainerRef.current;
    if (m) ro.observe(m);
    if (d) ro.observe(d);
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", measureLines);
    window.addEventListener("resize", measureLines);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", measureLines);
      window.removeEventListener("resize", measureLines);
    };
  }, [measureLines, steps.length, openId]);

  const railCell =
    "relative z-10 flex w-full min-w-0 shrink-0 items-start justify-center";

  const n = steps.length;
  const showMobileLine = mobileLine && mobileLine.height > 0;
  const showDesktopLine = desktopLine && desktopLine.height > 0;

  return (
    <>
      {/* Mobile: fixed rail column — line centered in rail, dots in same column */}
      <div ref={mobileContainerRef} className="relative md:hidden">
        {showMobileLine ? (
          <div
            className="pointer-events-none absolute left-[10px] z-0 w-0.5 -translate-x-1/2 bg-wine/35"
            style={{ top: mobileLine.top, height: mobileLine.height }}
            aria-hidden
          />
        ) : null}
        <ol className="relative z-10 flex flex-col gap-14">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-4"
            >
              <div className={railCell}>
                <TimelineDot
                  ref={assignDotPairRef(
                    index,
                    n,
                    mobileFirstDotRef,
                    mobileLastDotRef,
                  )}
                  active={openId === step.id}
                />
              </div>
              <div ref={(el) => setItemRef(step.id, el)} className="min-w-0">
                <StepCard
                  step={step}
                  index={index}
                  locale={locale}
                  labels={labels}
                  open={openId === step.id}
                  onToggle={() => toggle(step.id)}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Desktop: symmetric 1fr — rail — 1fr; line centered on page = rail axis */}
      <div
        ref={desktopContainerRef}
        className="relative mx-auto hidden w-full max-w-5xl md:block"
      >
        {showDesktopLine ? (
          <div
            className="pointer-events-none absolute left-1/2 z-0 w-0.5 -translate-x-1/2 bg-wine/40"
            style={{ top: desktopLine.top, height: desktopLine.height }}
            aria-hidden
          />
        ) : null}
        <ol className="relative z-10 flex flex-col gap-24 pb-10">
          {steps.map((step, index) => {
            const isLeft = index % 2 === 0;
            return (
              <li key={step.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-start gap-x-8 lg:gap-x-10">
                  {isLeft ? (
                    <>
                      <div className="flex min-w-0 justify-end">
                        <div
                          ref={(el) => setItemRef(step.id, el)}
                          className="w-full max-w-md"
                        >
                          <StepCard
                            step={step}
                            index={index}
                            locale={locale}
                            labels={labels}
                            open={openId === step.id}
                            onToggle={() => toggle(step.id)}
                          />
                        </div>
                      </div>
                      <div className={railCell}>
                        <TimelineDot
                          ref={assignDotPairRef(
                            index,
                            n,
                            desktopFirstDotRef,
                            desktopLastDotRef,
                          )}
                          active={openId === step.id}
                        />
                      </div>
                      <div aria-hidden className="min-w-0" />
                    </>
                  ) : (
                    <>
                      <div aria-hidden className="min-w-0" />
                      <div className={railCell}>
                        <TimelineDot
                          ref={assignDotPairRef(
                            index,
                            n,
                            desktopFirstDotRef,
                            desktopLastDotRef,
                          )}
                          active={openId === step.id}
                        />
                      </div>
                      <div className="flex min-w-0 justify-start">
                        <div
                          ref={(el) => setItemRef(step.id, el)}
                          className="w-full max-w-md"
                        >
                          <StepCard
                            step={step}
                            index={index}
                            locale={locale}
                            labels={labels}
                            open={openId === step.id}
                            onToggle={() => toggle(step.id)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
