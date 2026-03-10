/**
 * components/ui/form/FilterSelect.tsx
 *
 * Select reutilizable para filtros inline.
 * Usado en ActionQueuePage y LogisticsPage.
 */

interface FilterSelectProps {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}

export function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
