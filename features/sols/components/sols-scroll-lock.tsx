"use client";

import { useEffect } from "react";

export function SolsScrollLock() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    document.documentElement.classList.add("sols-scroll-lock");
    document.body.classList.add("sols-scroll-lock");

    return () => {
      document.documentElement.classList.remove("sols-scroll-lock");
      document.body.classList.remove("sols-scroll-lock");
    };
  }, []);

  return null;
}
