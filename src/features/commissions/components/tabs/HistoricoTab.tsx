/**
 * HistoricoTab — comisiones reales de meses cerrados (no proyectadas).
 *
 * Solo se renderiza si el mes seleccionado es un mes pasado / cerrado. Para
 * el mes en curso, la pestaña Resumen es la vista correcta. Si el usuario
 * intenta ver el Histórico de un mes en curso, mostramos un cartel.
 */
import CommissionTable from "../CommissionTable";
import type { UseCompensationResult } from "../../hooks/useCompensation";

interface Props {
  data: UseCompensationResult;
}

export default function HistoricoTab({ data }: Props) {
  const { time, rows } = data;

  if (!time.isMonthClosed) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
        El Histórico solo aplica a meses cerrados. Cambiá el selector de mes a
        un mes pasado para ver las comisiones reales.
      </div>
    );
  }

  const results = rows.map((r) => r.result);

  return <CommissionTable results={results} />;
}
