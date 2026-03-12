/**
 * hooks/useScrollDirection.ts
 *
 * Tracks scroll direction to power auto-hide header pattern.
 * Returns "up" | "down" | "top" — the header should be visible
 * when direction is "up" or "top".
 *
 * Uses passive scroll listener + requestAnimationFrame for smooth
 * 60fps performance without layout thrashing.
 */
import { useState, useEffect, useRef } from "react";

export type ScrollDirection = "up" | "down" | "top";

const THRESHOLD = 8; // px — ignore micro-scrolls (jitter, trackpad bounce)

export function useScrollDirection(): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("top");
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    function update() {
      const y = window.scrollY;

      if (y <= THRESHOLD) {
        setDirection("top");
      } else if (y > lastY.current + THRESHOLD) {
        setDirection("down");
      } else if (y < lastY.current - THRESHOLD) {
        setDirection("up");
      }

      lastY.current = y;
      ticking.current = false;
    }

    function onScroll() {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return direction;
}
