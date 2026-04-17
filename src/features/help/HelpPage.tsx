/**
 * features/help/HelpPage.tsx
 *
 * Guía de uso interactiva del dashboard.
 * Contenido adaptado al rol del usuario — solo muestra secciones accesibles.
 * Usa los mismos patrones UI que el resto del dashboard:
 *   - Card (rounded-2xl, border-gray-200)
 *   - Section (label | divider | actions)
 *   - exec-anim-* staggered entrance
 *   - Segmented controls (ActionQueue style)
 *   - StatCard label typography (11px uppercase tracking-widest)
 */
import { useState, useCallback } from "react";
import { Link } from "react-router";
import PageMeta from "@/components/common/PageMeta";
import { useAuth } from "@/hooks/useAuth";
import { getVisibleSections, type GuideSection } from "@/domain/help/guide";
import { getRoleLabel } from "@/domain/auth/types";
import {
  BoltIcon,
  DollarLineIcon,
  ListIcon,
  ShipIcon,
  WarehouseIcon,
  CalenderIcon,
  GroupIcon,
  ChevronDownIcon,
  ArrowRightIcon,
  InfoIcon,
} from "@/icons";

// ─── Icon mapping (domain icon string → React component) ────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  bolt:      <BoltIcon />,
  dollar:    <DollarLineIcon />,
  list:      <ListIcon />,
  ship:      <ShipIcon />,
  warehouse: <WarehouseIcon />,
  calendar:  <CalenderIcon />,
  group:     <GroupIcon />,
};

function getSectionIcon(icon: string): React.ReactNode {
  return ICON_MAP[icon] ?? <BoltIcon />;
}

// ─── Section Card ────────────────────────────────────────────────────────────

function GuideSectionCard({
  section,
  isOpen,
  onToggle,
  index,
}: {
  section: GuideSection;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <div
      id={`guide-${section.id}`}
      className="rounded-2xl border border-gray-200 bg-white transition-colors duration-[var(--duration-fast)] hover:shadow-theme-xs dark:border-gray-700 dark:bg-gray-800"
      style={{
        animation: `exec-fade-slide-up 0.45s cubic-bezier(0, 0, 0.2, 1) ${140 + index * 60}ms both`,
      }}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6"
        aria-expanded={isOpen}
        aria-controls={`guide-content-${section.id}`}
      >
        {/* Icon */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
          {getSectionIcon(section.icon)}
        </span>

        {/* Title + summary */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {section.title}
            </h3>
            <span className="hidden rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400 sm:inline-flex dark:bg-gray-700 dark:text-gray-500">
              {section.features.length} funciones
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">
            {section.summary}
          </p>
        </div>

        {/* Path badge + chevron */}
        <span className="hidden text-[11px] font-medium tabular-nums text-gray-300 sm:block dark:text-gray-600">
          {section.path}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-gray-300 transition-transform duration-[var(--duration-normal)] dark:text-gray-600 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Content — collapsible */}
      <div
        id={`guide-content-${section.id}`}
        className="grid transition-all duration-[var(--duration-slow)]"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-gray-200 px-5 pb-6 pt-5 dark:border-gray-700 sm:px-6">
            {/* Summary */}
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {section.summary}
            </p>

            {/* Features grid — StatCard-inspired */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {section.features.map((feature, fi) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors duration-[var(--duration-fast)] dark:border-gray-700 dark:bg-white/[0.03]"
                  style={{
                    animation: isOpen
                      ? `exec-fade-slide-up 0.4s var(--ease-out) ${fi * 50}ms both`
                      : "none",
                  }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {feature.title}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Tips — accent-left border style like accent-positive StatCard */}
            <div className="mt-5 rounded-2xl border border-gray-200 border-l-[3px] border-l-warning-400 bg-white p-4 dark:border-gray-700 dark:border-l-warning-400 dark:bg-white/[0.03]">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-warning-600 dark:text-warning-400">
                Tips
              </p>
              <ul className="mt-2 space-y-1.5">
                {section.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-warning-400" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Go to page CTA */}
            <div className="mt-5 flex items-center justify-between">
              <Link
                to={section.path}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors duration-[var(--duration-fast)] hover:bg-brand-600"
              >
                Ir a {section.title}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
              <span className="text-[10px] text-gray-300 dark:text-gray-600">
                {section.features.length} funciones · {section.tips.length} tips
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Nav (Segmented Control style) ─────────────────────────────────────

function QuickNav({
  sections,
  openIds,
  onSelect,
}: {
  sections: GuideSection[];
  openIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Navegación rápida de guía"
      className="flex flex-wrap gap-1.5 exec-anim-2"
    >
      {sections.map((s) => {
        const isActive = openIds.has(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
              isActive
                ? "bg-brand-500 text-white"
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-700"
            }`}
          >
            <span className="h-3.5 w-3.5">{getSectionIcon(s.icon)}</span>
            <span className="hidden sm:inline">{s.title}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── HelpPage ────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { permissions, profile } = useAuth();
  const sections = getVisibleSections(permissions);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollToSection = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    requestAnimationFrame(() => {
      document.getElementById(`guide-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const expandAll = useCallback(() => {
    setOpenIds(new Set(sections.map((s) => s.id)));
  }, [sections]);

  const collapseAll = useCallback(() => {
    setOpenIds(new Set());
  }, []);

  const totalFeatures = sections.reduce((sum, s) => sum + s.features.length, 0);

  return (
    <>
      <PageMeta
        title="Ayuda | FenixBrands"
        description="Guía de uso del dashboard FenixBrands"
      />

      <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">

        {/* ── TIER 1 — Context ──────────────────────────────────────────── */}
        <div className="exec-anim-1">
          {/* Header row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Guía de Uso
                </h1>
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  {sections.length} secciones
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Conocé las secciones del dashboard y cómo sacarles provecho
              </p>
            </div>

            {/* Expand/Collapse — segmented control */}
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 self-start dark:border-gray-700">
              <button
                type="button"
                onClick={expandAll}
                className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
                  openIds.size === sections.length
                    ? "bg-brand-500 font-semibold text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                Expandir todo
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className={`px-3 py-1.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ${
                  openIds.size === 0
                    ? "bg-brand-500 font-semibold text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                Colapsar todo
              </button>
            </div>
          </div>

          {/* Role context bar — with stats */}
          {profile && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
              <span>
                Rol:{" "}
                <span className="font-semibold text-gray-600 dark:text-gray-300">
                  {getRoleLabel(profile.role)}
                </span>
              </span>
              <span className="hidden h-3 w-px bg-gray-200 sm:block dark:bg-gray-700" />
              <span>{totalFeatures} funciones documentadas</span>
              <span className="hidden h-3 w-px bg-gray-200 sm:block dark:bg-gray-700" />
              <span className="flex items-center gap-1">
                <InfoIcon className="h-3 w-3" />
                Adaptado a tu nivel de acceso
              </span>
            </div>
          )}
        </div>

        {/* ── TIER 1B — Quick Nav ────────────────────────────────────────── */}
        <div className="mt-5">
          <QuickNav
            sections={sections}
            openIds={openIds}
            onSelect={scrollToSection}
          />
        </div>

        {/* ── Section divider ────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center gap-4 exec-anim-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Secciones
          </span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          <span className="text-[11px] tabular-nums text-gray-300 dark:text-gray-600">
            {openIds.size}/{sections.length} abiertas
          </span>
        </div>

        {/* ── TIER 2 — Section Cards ─────────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          {sections.map((section, idx) => (
            <GuideSectionCard
              key={section.id}
              section={section}
              isOpen={openIds.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              index={idx}
            />
          ))}
        </div>

        {/* Empty state */}
        {sections.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20 text-center dark:border-gray-700 dark:bg-gray-800 exec-anim-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
              <InfoIcon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              No hay secciones disponibles para tu rol actual.
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Contactá a un administrador para ampliar tu acceso.
            </p>
          </div>
        )}

        {/* ── Footer — keyboard shortcut hint ────────────────────────────── */}
        {sections.length > 0 && (
          <div className="mt-6 pb-2 text-center exec-anim-8">
            <p className="text-[11px] text-gray-300 dark:text-gray-600">
              Hacé click en las pills de arriba para navegar rápido entre secciones
            </p>
          </div>
        )}
      </div>
    </>
  );
}
