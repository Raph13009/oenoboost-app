"use client";

import { useEffect } from "react";

export function DegustationScrollLock() {
  useEffect(() => {
    const main = document.getElementById("app-main");
    main?.classList.add("degustation-scroll-lock");

    return () => {
      main?.classList.remove("degustation-scroll-lock");
    };
  }, []);

  return null;
}
