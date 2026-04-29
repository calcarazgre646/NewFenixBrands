/**
 * features/action-queue/components/FilterPopover.tsx
 *
 * Filtro de dimensión estilo BI (Toolio / Blue Yonder / Oracle Retail):
 * trigger pill compacto + popover con search + lista single-select con counts.
 *
 * El panel se renderiza vía Portal para escapar stacking contexts de ancestros
 * (animaciones, transforms) que de otra forma lo dejarían detrás del contenido.
 */
import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { DimensionOption } from "@/domain/actionQueue/dimensionFilters";

interface Props {
  label: string;
  /** Etiqueta corta cuando NO hay valor seleccionado, ej: "Todos". */
  placeholder?: string;
  value: string | null;
  options: DimensionOption[];
  onChange: (value: string | null) => void;
  /** Si options.length supera este umbral, mostramos input de búsqueda. */
  searchThreshold?: number;
}

const SEARCH_THRESHOLD_DEFAULT = 8;

export function FilterPopover({
  label,
  placeholder = "Todos",
  value,
  options,
  onChange,
  searchThreshold = SEARCH_THRESHOLD_DEFAULT,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  // Compute popover position from trigger when opening
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, [open]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // Click outside (covers trigger + portal) + Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inTrigger && !inPopover) close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  // Auto-focus search when opening
  useEffect(() => {
    if (open && searchInputRef.current) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const showSearch = options.length > searchThreshold;

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const needle = search.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(needle));
  }, [options, search]);

  const activeOption = useMemo(
    () => (value ? options.find(o => o.value === value) ?? null : null),
    [value, options],
  );

  const totalCount = useMemo(
    () => options.reduce((s, o) => s + o.count, 0),
    [options],
  );

  const handleSelect = (next: string | null) => {
    onChange(next);
    close();
  };

  if (options.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
          activeOption
            ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/50"
        }`}
      >
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
          activeOption ? "text-brand-500 dark:text-brand-400" : "text-gray-400 dark:text-gray-500"
        }`}>
          {label}
        </span>
        <span className="font-semibold">
          {activeOption?.label ?? placeholder}
        </span>
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${
            activeOption ? "text-brand-500 dark:text-brand-400" : "text-gray-400"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && position && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          className="fixed z-[100] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-dark"
          style={{
            top: position.top,
            left: position.left,
            minWidth: Math.max(position.width, 240),
            animation: "exec-fade-slide-up 0.18s var(--ease-out)",
          }}
        >
          {showSearch && (
            <div className="border-b border-gray-100 p-2 dark:border-gray-700/60">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Buscar ${label.toLowerCase()}…`}
                  className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-7 pr-2 text-[12px] text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => handleSelect(null)}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors ${
                value === null
                  ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span>{placeholder}</span>
              <span className="text-[10px] tabular-nums text-gray-400">
                {totalCount.toLocaleString("es-PY")}
              </span>
            </button>

            {filteredOptions.length === 0 && (
              <p className="px-3 py-3 text-center text-[11px] text-gray-400">
                Sin resultados
              </p>
            )}

            {filteredOptions.map(opt => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors ${
                    isActive
                      ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  <span className={`ml-2 shrink-0 text-[10px] tabular-nums ${
                    isActive ? "text-brand-500" : "text-gray-400"
                  }`}>
                    {opt.count.toLocaleString("es-PY")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Chip de filtro activo, removible.
 */
export function ActiveFilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="group inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-brand-600"
      aria-label={`Quitar filtro ${label}: ${value}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-80">{label}:</span>
      <span className="font-semibold">{value}</span>
      <svg
        className="h-3 w-3 opacity-80 transition-transform group-hover:rotate-90"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
