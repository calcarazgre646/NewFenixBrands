/**
 * components/search/GlobalSearch.tsx
 *
 * Buscador global: páginas, indicadores (KPIs), acciones rápidas.
 *
 * Páginas y acciones son navegables (click/Enter).
 * KPIs son informativos: se muestran inline sin navegación (no hay página destino).
 *
 * Features:
 *   - Multi-word matching con scoring
 *   - ⌘K / Ctrl+K para focus
 *   - ↑↓ navegar, Enter seleccionar, Escape cerrar
 *   - Highlight de matches (con regex seguro)
 *   - Agrupado por tipo (Páginas → Indicadores → Acciones)
 *   - Dark mode + accesibilidad (combobox ARIA)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTheme } from "@/context/ThemeContext";
import { buildSearchCatalog } from "@/domain/search/catalog";
import { search, groupResults, escapeRegex } from "@/domain/search/engine";
import type { SearchResult, SearchGroup } from "@/domain/search/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 150;
const MAX_RESULTS = 12;

// ─── Icon map (SVG inline — lightweight, no external deps) ───────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M3.04 9.37a6.33 6.33 0 1 1 12.67 0 6.33 6.33 0 0 1-12.67 0Zm6.34-7.83a7.83 7.83 0 1 0 4.98 13.88l2.82 2.82a.75.75 0 1 0 1.06-1.06l-2.82-2.82A7.83 7.83 0 0 0 9.38 1.54Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function KpiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ActionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  page: PageIcon,
  kpi: KpiIcon,
  action: ActionIcon,
};

// ─── Highlight helper ─────────────────────────────────────────────────────────

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = escapeRegex(query.trim());
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <mark key={i} className="bg-brand-100 dark:bg-brand-500/30 text-brand-700 dark:text-brand-300 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();

  // Build catalog once (stable reference — 9 KPIs core + 5 pages + actions)
  const catalog = useMemo(() => buildSearchCatalog(), []);

  // ── Debounced search ─────────────────────────────────────────────────────
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const r = search(catalog, query, MAX_RESULTS);
      setResults(r);
      setSelectedIndex(0);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, catalog]);

  // Open/close logic
  useEffect(() => {
    setIsOpen(query.length > 0);
  }, [query]);

  // ── Grouped results ──────────────────────────────────────────────────────
  const groups: SearchGroup[] = useMemo(() => groupResults(results), [results]);

  // Flat list for keyboard navigation (preserves group order)
  const flatResults = useMemo(() => groups.flatMap((g) => g.results), [groups]);

  // ── ⌘K global shortcut ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Click outside ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Selection handler (only for navigable items) ─────────────────────────
  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (!result.path) return; // KPIs are informational — no navigation
      if (result.path.startsWith("__action:")) {
        const action = result.path.replace("__action:", "");
        if (action === "toggle-theme") toggleTheme();
      } else {
        navigate(result.path);
      }
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [navigate, toggleTheme],
  );

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (flatResults[selectedIndex]) handleSelect(flatResults[selectedIndex]);
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // ── Scroll selected into view ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const el = document.getElementById(`search-result-${selectedIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  // ── Render helpers ───────────────────────────────────────────────────────
  let globalIdx = -1;

  return (
    <div ref={containerRef} className="relative w-full xl:w-[430px]">
      {/* ── Input ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen && flatResults.length > 0}
          aria-controls="search-results"
          aria-activedescendant={isOpen ? `search-result-${selectedIndex}` : undefined}
          aria-label="Buscar páginas, indicadores, acciones"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length > 0 && setIsOpen(true)}
          placeholder="Buscar páginas, indicadores..."
          className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          <kbd className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
            <span>⌘</span><span>K</span>
          </kbd>
        </div>
      </div>

      {/* ── Results dropdown ──────────────────────────────────────────── */}
      {isOpen && flatResults.length > 0 && (
        <div
          id="search-results"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-[9999] max-h-[420px] overflow-y-auto"
        >
          <div className="p-2">
            {groups.map((group) => (
              <div key={group.type}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  {group.label}
                </div>
                {group.results.map((result) => {
                  globalIdx++;
                  const idx = globalIdx;
                  const Icon = TYPE_ICON[result.type] ?? PageIcon;
                  const isSelected = idx === selectedIndex;
                  const isNavigable = !!result.path;

                  const content = (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {highlightText(result.title, query)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {highlightText(result.subtitle, query)}
                        </p>
                        {result.meta?.category && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {result.meta.category}
                            {result.meta.kpiId && (
                              <>
                                <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
                                <span className="font-mono">{result.meta.kpiId}</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  // KPIs: informational only (no click, no keyboard select)
                  if (!isNavigable) {
                    return (
                      <div
                        key={result.id}
                        id={`search-result-${idx}`}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        className={`px-3 py-2.5 rounded-lg transition-colors cursor-default ${
                          isSelected
                            ? "bg-gray-50 dark:bg-gray-800"
                            : ""
                        }`}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        {content}
                      </div>
                    );
                  }

                  // Pages & actions: clickable
                  return (
                    <button
                      key={result.id}
                      id={`search-result-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                        isSelected
                          ? "bg-brand-50 dark:bg-brand-500/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Keyboard hints footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">↓</kbd>
              navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">↵</kbd>
              ir
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">esc</kbd>
              cerrar
            </span>
          </div>
        </div>
      )}

      {/* ── No results ────────────────────────────────────────────────── */}
      {isOpen && query.trim() && flatResults.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-[9999] p-6 text-center">
          <SearchIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sin resultados para "<span className="font-medium">{query}</span>"
          </p>
        </div>
      )}
    </div>
  );
}
