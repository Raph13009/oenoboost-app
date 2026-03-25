"use client";

import { useEffect } from "react";

export function QuizScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.getElementById("app-main");
    const preventScroll = (event: Event) => {
      event.preventDefault();
    };

    html.classList.add("quiz-scroll-lock");
    body.classList.add("quiz-scroll-lock");
    main?.classList.add("quiz-scroll-lock");
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      html.classList.remove("quiz-scroll-lock");
      body.classList.remove("quiz-scroll-lock");
      main?.classList.remove("quiz-scroll-lock");
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  }, []);

  return null;
}
