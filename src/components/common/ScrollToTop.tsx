/**
 * components/common/ScrollToTop.tsx
 *
 * Resets scroll position to top on every route change.
 * Placed once inside <BrowserRouter> — structural fix, not per-page.
 */
import { useEffect } from "react";
import { useLocation } from "react-router";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
