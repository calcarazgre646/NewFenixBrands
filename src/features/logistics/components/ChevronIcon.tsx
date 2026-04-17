/**
 * features/logistics/components/ChevronIcon.tsx
 *
 * Icono chevron reutilizado en tablas y acordeones de logística.
 */
export function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${className ?? "h-4 w-4 text-gray-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
