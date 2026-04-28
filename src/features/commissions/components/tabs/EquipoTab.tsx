/**
 * EquipoTab — pestaña con la tabla completa del equipo (gerencia/super_user).
 * Click en una fila → drill a las transacciones del vendedor.
 */
import { useState } from "react";
import CompensationTeamTable from "../CompensationTeamTable";
import TransactionsDrawer from "../TransactionsDrawer";
import type { UseCompensationResult } from "../../hooks/useCompensation";

interface Props {
  data: UseCompensationResult;
  year: number;
  month: number;
}

export default function EquipoTab({ data, year, month }: Props) {
  const [selected, setSelected] = useState<{ codigo: number; nombre: string } | null>(null);

  const projections = data.rows.map((r) => r.projection);

  return (
    <>
      <CompensationTeamTable
        rows={projections}
        onRowClick={(codigo, nombre) => setSelected({ codigo, nombre })}
      />
      <TransactionsDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        year={year}
        month={month}
        vendedorCodigo={selected?.codigo ?? null}
        vendedorNombre={selected?.nombre ?? ""}
      />
    </>
  );
}
