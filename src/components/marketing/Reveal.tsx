"use client";

import { useEffect } from "react";

/**
 * One observer for the whole page: every [data-reveal] element fades and rises in once as it enters the viewport.
 * Without JS, or with reduced motion, nothing is hidden (the hidden state only applies under html[data-reveal="on"]).
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.dataset.motion === "reduce";
    if (reduce || typeof IntersectionObserver === "undefined") return;

    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Anything already on screen at load shows immediately, so the first paint never blinks out.
    const vh = window.innerHeight;
    for (const el of els) {
      if (el.getBoundingClientRect().top < vh * 0.92) el.dataset.shown = "";
    }
    root.dataset.reveal = "on";

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.shown = "";
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    for (const el of els) if (!("shown" in el.dataset)) io.observe(el);
    return () => {
      io.disconnect();
      delete root.dataset.reveal;
    };
  }, []);
  return null;
}
