/**
 * components/ui/chart/ResponsiveChart.tsx
 *
 * Drop-in replacement for react-apexcharts' <Chart> that stays in sync
 * with its container width — even during CSS transitions (sidebar toggle).
 *
 * Uses ResizeObserver to measure the container's real pixel width and
 * passes it as the `width` prop to react-apexcharts, which triggers
 * an internal `updateOptions()` redraw whenever width changes.
 */
import { useRef, useState, useCallback, useEffect, type ComponentProps } from "react";
import Chart from "react-apexcharts";

type ChartProps = ComponentProps<typeof Chart>;

export default function ResponsiveChart(props: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const measure = useCallback(() => {
    if (containerRef.current) {
      const w = containerRef.current.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.floor(w));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measure
    measure();

    observerRef.current = new ResizeObserver(() => {
      measure();
    });
    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [measure]);

  return (
    <div ref={containerRef}>
      {width > 0 && (
        <Chart {...props} width={width} />
      )}
    </div>
  );
}
