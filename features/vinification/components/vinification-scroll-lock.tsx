"use client";

import { useEffect } from "react";

export function VinificationScrollLock() {
  useEffect(() => {
    document.documentElement.classList.add("vinification-scroll-lock");
    document.body.classList.add("vinification-scroll-lock");

    return () => {
      document.documentElement.classList.remove("vinification-scroll-lock");
      document.body.classList.remove("vinification-scroll-lock");
    };
  }, []);

  return null;
}
