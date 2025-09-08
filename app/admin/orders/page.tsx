"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  code: string;
  createdAt: string;
  status?: string;
  client: { id: string; fullName: string };
  totalList?: number;   // subtotal (centavos)
  discount?: number;    // descuento (centavos)
  amount?: number;      // opcional (subtotal - descuento en centavos) si lo manda el backend
  totalFinal?: number;  // fallback
};

function fmtMoney(cents: number) {
  const n = Math.round(cents || 0) / 100;
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

export default function OrdersPage() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const url = `/api/orders${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      const r = await fetch(url, { cache: "no-store" });
      const json = await r.json();
      setList(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar la orden? Esta acción no se puede deshacer.")) return;
    setDeleting(id);
    try {
      const r = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        alert("No se pudo eliminar la orden.\n" + t);
      } else {
        setList((prev) => prev.filter((x) => x.id !== id));
      }
    } catch (e) {
      console.error(e);
      alert("Error eliminando la orden.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Órdenes</h1>
          <div className="flex items-center gap-2">
            <form
              onSubmit={(e)=>{ e.preventDefault(); load(); }}
              className="hidden md:flex items-center gap-2"
            >
              <input
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                placeholder="Buscar por código / cliente"
                value={q}
                onChange={(e)=>setQ(e.target.value)}
              />
              <button className="rounded-lg border border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 px-3 py-2">
                Buscar
              </button>
            </form>
            <Link
              href="/admin/orders/new"
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-900 px-4 py-2 font-medium"
            >
              + Nueva orden
            </Link>
          </div>
        </div>

        {/* Listado */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/70 text-neutral-400">
              <tr>
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-right">Importe (Subtotal − Descuento)</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No hay órdenes.
                  </td>
                </tr>
              )}
              {list.map((row) => {
                const safeAmount =
                  typeof row.amount === "number"
                    ? row.amount
                    : Math.max((row.totalList || 0) - (row.discount || 0), 0) ||
                      Math.max((row.totalFinal || 0), 0); // último fallback

                return (
                  <tr key={row.id} className="border-t border-neutral-800/70">
                    <td className="px-4 py-3">{row.code}</td>
                    <td className="px-4 py-3">
                      {new Date(row.createdAt || (row as any).date).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clients/${row.client?.id}`}
                        className="text-emerald-300 hover:underline"
                      >
                        {row.client?.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {fmtMoney(safeAmount)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        href={`/admin/orders/${row.id}`}
                        className="inline-flex rounded-md border border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 px-3 py-1.5"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deleting === row.id}
                        className="inline-flex rounded-md border border-red-600 text-red-300 hover:bg-red-600/10 px-3 py-1.5 disabled:opacity-50"
                      >
                        {deleting === row.id ? "Eliminando…" : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Link atrás + búsqueda móvil */}
        <div className="flex items-center justify-between">
          <Link href="/admin" className="text-emerald-400 hover:underline">
            ← Volver al panel
          </Link>
          <form
            onSubmit={(e)=>{ e.preventDefault(); load(); }}
            className="md:hidden flex items-center gap-2"
          >
            <input
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              placeholder="Buscar por código / cliente"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
            />
            <button className="rounded-lg border border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 px-3 py-2">
              Buscar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
