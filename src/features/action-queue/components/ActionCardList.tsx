/**
 * features/action-queue/components/ActionCardList.tsx
 *
 * Grid responsivo de ActionCards con paginación.
 * 1 col mobile → 2 tablet → 3 desktop.
 */
import { useState, useMemo } from "react";
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { GroupByMode } from "@/domain/actionQueue/grouping";
import type { ViewProfile } from "@/domain/auth/types";
import { ActionCard } from "./ActionCard";
import { FEATURE_PAGE_SIZE } from "@/domain/config/defaults";

const PAGE_SIZE = FEATURE_PAGE_SIZE;

interface Props {
  items: ActionItemFull[];
  groupMode: GroupByMode;
  viewProfile?: ViewProfile;
}

export function ActionCardList({ items, groupMode, viewProfile = "detail" }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));

  const paginatedItems = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

  const showStore = groupMode === "brand" || groupMode === "priority";

  if (items.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {paginatedItems.map((item, idx) => (
          <div
            key={item.id}
            style={{
              animation: `exec-fade-slide-up 0.3s var(--ease-out) ${idx * 30}ms both`,
            }}
          >
            <ActionCard
              item={item}
              showStore={showStore}
              viewProfile={viewProfile}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 dark:bg-gray-800/60">
          <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, items.length)} de {items.length}
          </span>
          <div className="flex items-center gap-1">
            <PageBtn onClick={() => setPage(0)} disabled={safePage === 0}>&laquo;</PageBtn>
            <PageBtn onClick={() => setPage(p => p - 1)} disabled={safePage === 0}>&lsaquo;</PageBtn>
            <span className="px-2.5 text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-400">
              {safePage + 1}/{totalPages}
            </span>
            <PageBtn onClick={() => setPage(p => p + 1)} disabled={safePage >= totalPages - 1}>&rsaquo;</PageBtn>
            <PageBtn onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1}>&raquo;</PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-200 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}
