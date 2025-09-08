export default function ReportsPage() {
  const Card = ({ title, value, hint }: any) => (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-white">Reportes</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Ingresos (mes actual)" value="$ —" hint="Por facturación y extras" />
        <Card title="Egresos (mes actual)" value="$ —" hint="Mercadería, servicios, JV, comisiones" />
        <Card title="Resultado (mes actual)" value="$ —" hint="Ingresos – Egresos" />
      </div>

      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5">
        <div className="text-sm text-zinc-300">Filtros</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input type="date" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
          <input type="date" className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
          <button className="rounded-xl border border-emerald-600/40 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-600/30">
            Aplicar
          </button>
        </div>
        <div className="mt-6 text-sm text-zinc-400">
          Próximo: cuadros por categoría (Facturación, Extras, Servicios, JV, Comisiones) y exportar CSV.
        </div>
      </div>
    </div>
  );
}
