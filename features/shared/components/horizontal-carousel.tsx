"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CAROUSEL_CARD_SELECTOR = "[data-carousel-card]";

type HorizontalCarouselProps = {
  children: React.ReactNode;
  prevLabel: string;
  nextLabel: string;
  itemCount: number;
};

/** Block link clicks only when the track actually scrolled (avoids killing taps on small pointer wobble). */
const SCROLL_DELTA_TO_SUPPRESS_LINK_PX = 12;
const INERTIA_FRICTION = 0.94;
const MIN_VELOCITY = 0.45;

export function HorizontalCarousel({
  children,
  prevLabel,
  nextLabel,
  itemCount,
}: HorizontalCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startScroll: number;
    lastX: number;
    lastT: number;
    velocity: number;
  } | null>(null);
  const inertiaRafRef = useRef<number | null>(null);

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    el?.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el?.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [itemCount, updateScrollState]);

  const stopInertia = useCallback(() => {
    if (inertiaRafRef.current != null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  const scrollByDirection = (dir: -1 | 1) => {
    stopInertia();
    const el = trackRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(CAROUSEL_CARD_SELECTOR);
    const gap =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
        ? 16
        : 12;
    const step = first ? first.offsetWidth + gap : 280;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const runInertia = useCallback(
    (initialVelocity: number) => {
      const el = trackRef.current;
      if (!el || Math.abs(initialVelocity) < MIN_VELOCITY) return;

      stopInertia();
      let v = initialVelocity;

      const tick = () => {
        if (Math.abs(v) < MIN_VELOCITY) {
          inertiaRafRef.current = null;
          return;
        }
        el.scrollLeft -= v;
        v *= INERTIA_FRICTION;
        inertiaRafRef.current = requestAnimationFrame(tick);
      };
      inertiaRafRef.current = requestAnimationFrame(tick);
    },
    [stopInertia],
  );

  const onPointerDownCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      stopInertia();
      const el = trackRef.current;
      if (!el) return;

      suppressClickRef.current = false;
      dragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startScroll: el.scrollLeft,
        lastX: e.clientX,
        lastT: performance.now(),
        velocity: 0,
      };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setIsDragging(true);
    },
    [stopInertia],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d?.active || e.pointerId !== d.pointerId || e.pointerType !== "mouse") return;

    const el = trackRef.current;
    if (!el) return;

    const dx = e.clientX - d.startX;
    el.scrollLeft = d.startScroll - dx;

    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    const instantV = ((e.clientX - d.lastX) / dt) * 16;
    d.velocity = d.velocity * 0.35 + instantV * 0.65;
    d.lastX = e.clientX;
    d.lastT = now;
  }, []);

  const endMouseDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d?.active || e.pointerId !== d.pointerId || e.pointerType !== "mouse") return;

      const el = trackRef.current;
      const releaseVelocity = d.velocity;
      const startScroll = d.startScroll;

      if (el) {
        suppressClickRef.current =
          Math.abs(el.scrollLeft - startScroll) >
          SCROLL_DELTA_TO_SUPPRESS_LINK_PX;
      } else {
        suppressClickRef.current = false;
      }

      dragRef.current = null;
      setIsDragging(false);

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      if (Math.abs(releaseVelocity) > MIN_VELOCITY) {
        runInertia(releaseVelocity);
      }
    },
    [runInertia],
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onClickCapture = (ev: MouseEvent) => {
      if (!suppressClickRef.current) return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest("a[href]")) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      suppressClickRef.current = false;
    };

    el.addEventListener("click", onClickCapture, true);
    return () => el.removeEventListener("click", onClickCapture, true);
  }, [itemCount]);

  const arrowClass =
    "pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/95 text-wine shadow-md backdrop-blur-sm transition hover:border-wine/30 hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-35 md:h-11 md:w-11";

  return (
    <div className="relative w-full pb-6 md:pb-8">
      <button
        type="button"
        aria-label={prevLabel}
        className={cn(arrowClass, "absolute left-2 top-1/2 z-10 -translate-y-1/2 md:left-5")}
        disabled={!canPrev}
        onClick={() => scrollByDirection(-1)}
      >
        <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label={nextLabel}
        className={cn(arrowClass, "absolute right-2 top-1/2 z-10 -translate-y-1/2 md:right-5")}
        disabled={!canNext}
        onClick={() => scrollByDirection(1)}
      >
        <ChevronRight className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.75} />
      </button>

      <div
        ref={trackRef}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={endMouseDrag}
        onPointerCancel={endMouseDrag}
        onPointerLeave={(e) => {
          if (dragRef.current?.active && e.pointerType === "mouse") {
            endMouseDrag(e);
          }
        }}
        className={cn(
          "no-scrollbar touch-pan-x snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch]",
          "select-none py-5 pb-16 pt-5 md:py-7 md:pb-20 md:pt-6",
          "cursor-grab active:cursor-grabbing",
          isDragging && "cursor-grabbing",
          "scroll-pl-[max(1rem,calc(50vw-5.875rem))] scroll-pr-[max(1rem,calc(50vw-5.875rem))]",
          "md:scroll-pl-[max(2rem,calc(50vw-7.5rem))] md:scroll-pr-[max(2rem,calc(50vw-7.5rem))]",
        )}
        style={{ scrollBehavior: "auto" }}
      >
        <div
          className={cn(
            "flex w-max items-center gap-3 md:gap-4",
            "pl-[max(1rem,calc(50vw-5.875rem))] pr-[max(1rem,calc(50vw-5.875rem))]",
            "md:pl-[max(2rem,calc(50vw-7.5rem))] md:pr-[max(2rem,calc(50vw-7.5rem))]",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
