import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/**
 * Calculates tooltip position relative to the viewport using a portal.
 * Renders outside the DOM hierarchy to avoid overflow/z-index issues.
 */
export function Tooltip({
  content,
  children,
  position = "top",
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useRef(`tooltip-${Math.random().toString(36).slice(2, 9)}`);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const r = trigger.getBoundingClientRect();
    const t = tooltip.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = r.top - t.height - gap;
        left = r.left + r.width / 2 - t.width / 2;
        break;
      case "bottom":
        top = r.bottom + gap;
        left = r.left + r.width / 2 - t.width / 2;
        break;
      case "left":
        top = r.top + r.height / 2 - t.height / 2;
        left = r.left - t.width - gap;
        break;
      case "right":
        top = r.top + r.height / 2 - t.height / 2;
        left = r.right + gap;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - t.height - 8));

    setCoords({ top, left });
  }, [position]);

  useEffect(() => {
    if (visible) updatePosition();
  }, [visible, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function show() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
  }

  function hide() {
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setCoords(null);
    }, 100);
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={`relative inline-flex ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <span aria-describedby={visible ? id.current : undefined}>
          {children}
        </span>
      </span>
      {visible &&
        createPortal(
          <span
            ref={tooltipRef}
            id={id.current}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              opacity: coords ? 1 : 0,
              transition: "opacity 150ms ease",
            }}
            className="pointer-events-none z-[99999] whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-tooltip dark:bg-gray-700"
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
