/**
 * features/sales/components/ChannelCard.tsx
 *
 * Channel mix horizontal bar chart (B2C vs B2B).
 */
import { useState, useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import ResponsiveChart from "@/components/ui/chart/ResponsiveChart";
import type { ChannelMixRow, MonthlySalesRow } from "@/queries/sales.queries";
import type { TicketRow } from "@/queries/tickets.queries";
import type { StoreBreakdownRow } from "../hooks/useSalesAnalytics";
import { formatPYGShort } from "@/utils/format";
import { Card } from "@/components/ui/card/Card";
import { SectionLabel } from "./salesAnalytics.shared";
import { StoreDetailView } from "./StoreDetailView";

export function ChannelCard({
  channelMix,
  storeBreakdown,
  channelMode,
  salesWideRaw,
  ticketRows,
  ticketStoreMap,
  activeMonths,
  brand,
}: {
  channelMix: ChannelMixRow[];
  storeBreakdown: StoreBreakdownRow[];
  channelMode: string;
  isStoresLoading: boolean;
  salesWideRaw?: MonthlySalesRow[];
  ticketRows?: TicketRow[];
  ticketStoreMap?: Map<string, string>;
  activeMonths?: number[];
  brand?: string;
}) {
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const sorted = [...channelMix].sort((a, b) => b.neto - a.neto);

  // Store detail view
  const storeDetail = selectedStore
    ? storeBreakdown.find((s) => s.storeCode === selectedStore)
    : null;

  // Horizontal bar chart options for channel comparison
  const barOptions: ApexOptions = useMemo(() => ({
    chart: {
      type: "bar",
      fontFamily: "Outfit, sans-serif",
      background: "transparent",
      toolbar: { show: false },
      animations: { enabled: true, dynamicAnimation: { speed: 600 } },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "60%",
        borderRadius: 6,
        borderRadiusApplication: "end",
        distributed: true,
      },
    },
    colors: ["#465FFF", "#93AAFD"],
    dataLabels: {
      enabled: true,
      style: { fontSize: "13px", fontWeight: "700", fontFamily: "Outfit, sans-serif" },
      formatter: (_: number, opts: { dataPointIndex: number }) =>
        `${sorted[opts.dataPointIndex]?.pct.toFixed(1) ?? 0}%`,
      offsetX: 4,
    },
    xaxis: {
      categories: sorted.map((c) => c.channel),
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: "13px", fontWeight: 700, colors: "#667085", fontFamily: "Outfit, sans-serif" },
      },
    },
    grid: { show: false },
    legend: { show: false },
    tooltip: {
      enabled: true,
      y: { formatter: (val: number) => formatPYGShort(val) },
    },
    responsive: [{
      breakpoint: 640,
      options: {
        dataLabels: { style: { fontSize: "11px" } },
        yaxis: { labels: { style: { fontSize: "11px" } } },
      },
    }],
  }), [sorted]);

  if (storeDetail) {
    return (
      <Card padding="lg">
        <StoreDetailView
          store={storeDetail}
          onBack={() => setSelectedStore(null)}
          channelLabel={channelMode === "b2b" ? "B2B" : "B2C"}
          salesWideRaw={salesWideRaw}
          ticketRows={ticketRows}
          ticketStoreMap={ticketStoreMap}
          activeMonths={activeMonths}
          channelMode={channelMode}
          brand={brand}
        />
      </Card>
    );
  }

  // When channel is total → bar chart + metrics
  if (channelMode === "total") {
    if (channelMix.length === 0) {
      return (
        <Card padding="lg">
          <SectionLabel>Mix de Canal</SectionLabel>
          <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">Sin datos de canal</p>
        </Card>
      );
    }

    return (
      <Card padding="lg" className="flex h-full flex-col">
        <SectionLabel>Mix de Canal</SectionLabel>

        {/* Bar chart */}
        <div className="mt-2">
          <ResponsiveChart
            options={barOptions}
            series={[{ name: "Ventas", data: sorted.map((c) => c.neto) }]}
            type="bar"
            height={120}
          />
        </div>

        {/* Metrics row */}
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
          {sorted.map((c, i) => (
            <div key={c.channel} className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${i === 0 ? "bg-brand-500" : "bg-brand-300"}`} />
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{c.channel}</span>
              </div>
              <p className="mt-1 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                {formatPYGShort(c.neto)}
              </p>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // When channel is B2B or B2C → StoresTable already shown above, hide ChannelCard
  return null;
}
