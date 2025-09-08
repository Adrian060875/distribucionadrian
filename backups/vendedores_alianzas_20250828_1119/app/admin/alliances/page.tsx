"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Alliance = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  commissionType?: string;
  commissionPct: number;
};

type CommissionRow = {
  orderId: string;
  code: string;
  client: string;
  date: string;
  pct: number;
  // Todos estos valores en CENTAVOS (igual que vendedores)
  baseCollected: number;
  baseExpected: number;
  accruedCollected: number;
  accruedExpected: number;
  paid: number;
  balanceExpected: number;
  payments: { id: string; amount: number; date: string; notes?: string }[];
};

export default function AlliancesPage() {
  // lista + alta
  const [list, setList] = useState<Alliance[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", commissionPct: "5" });
  const [loading, setLoading] = useState(false);

  // ediciÃ³n inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", phone: "", email: "", commissionPct: "0" });

  // comisiones
  const [selected, setSelected] = useState<Alliance | null>(null);
  const [comm, setComm] = useState<{ pct: number; rows: CommissionRow[] } | null>(null);
  const [payForm, setPayForm] = useState({
    orderId: "",
    amount: "",
    date: new Date().toISOString().substring(0, 10),
    notes: "",
  });

  async function loadList() {
    const r = await fetch("/api/alliances", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    const rows: any[] = Array.isArray(j) ? j : j?.data ?? [];
    setList(
      rows.map((a) => ({
        id: a.id,
        name: a.name,
        phone: a.phone ?? null,
        email: a.email ?? null,
        commissionPct: Number(a.commissionPct ?? 0),
      }))
    );
  }
  useEffect(() => {
    loadList();
  }, []);

  // alta
  async function createAlliance(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/alliances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        commissionType: "PERCENT",
        commissionPct: Number(form.commissionPct || "0"),
      }),
    });
    setLoading(false);
    if (!r.ok) {
      alert("No se pudo crear");
      return;
    }
    setForm({ name: "", phone: "", email: "", commissionPct: "5" });
    loadList();
  }

  // ediciÃ³n
  function startEdit(a: Alliance) {
    setEditingId(a.id);
    setEdit({
      name: a.name,
      phone: a.phone || "",
      email: a.email || "",
      commissionPct: String(a.commissionPct ?? 0),
    });
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(id: string) {
    const r = await fetch(`/api/alliances`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: edit.name.trim(),
        phone: edit.phone.trim() || null,
        email: edit.email.trim() || null,
        commissionPct: Number(edit.commissionPct || "0"),
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(t || "No se pudo actualizar");
      return;
    }
    setEditingId(null);
    await loadList();
    if (selected && selected.id === id) {
      // si cambiÃ³ el %, refrescamos panel
      await loadCommissions({ ...selected, name: edit.name, phone: edit.phone, email: edit.email, commissionPct: Number(edit.commissionPct || "0") });
    }
  }

  // borrar
  async function deleteAlliance(id: string) {
    if (!confirm("Â¿Borrar alianza? Esta acciÃ³n no se puede deshacer.")) return;
    const r = await fetch(`/api/alliances`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(t || "No se pudo borrar");
      return;
    }
    if (selected?.id === id) {
      setSelected(null);
      setComm(null);
    }
    loadList();
  }

  // comisiones
  async function loadCommissions(a: Alliance) {
    setSelected(a);
    setComm(null);
    // usamos el mismo endpoint genÃ©rico que vendedores: /api/commissions
    const r = await fetch(`/api/commissions?allianceId=${a.id}`);
    if (!r.ok) {
      alert("No se pudo calcular comisiones");
      return;
    }
    setComm(await r.json());
    setPayForm((p) => ({ ...p, orderId: "", amount: "" }));
  }

  // registrar pago de comisiÃ³n
  async function registerPayment() {
    if (!selected || !payForm.orderId || !payForm.amount) return;
    const r = await fetch("/api/commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "ALLIANCE",
        allianceId: selected.id,
        orderId: payForm.orderId,
        amount: Math.round(Number(payForm.amount) * 100), // a centavos
        date: payForm.date,
        notes: payForm.notes || undefined,
      }),
    });
    if (!r.ok) {
      alert("No se pudo registrar el pago");
      return;
    }
    await loadCommissions(selected);
    setPayForm((p) => ({ ...p, amount: "", notes: "" }));
  }

  // anular pago
  async function deletePayment(id: string) {
    const r = await fetch(`/api/commissions?id=${id}`, { method: "DELETE" });
    if (!r.ok) {
      alert("No se pudo anular");
      return;
    }
    if (selected) loadCommissions(selected);
  }

  // saldo total esperado (centavos)
  const totalBalanceExpected = useMemo(() => {
    if (!comm) return 0;
    return comm.rows.reduce((a, r) => a + Math.max(r.balanceExpected, 0), 0);
  }, [comm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="rounded-lg border border-emerald-700/40 px-3 py-1.5 text-emerald-300 hover:bg-emerald-700/10"
        >
          â† Volver
        </Link>
        <h1 className="text-2xl font-semibold">Alianzas</h1>
      </div>

      {/* Alta rÃ¡pida */}
      <form
        onSubmit={createAlliance}
        className="grid md:grid-cols-5 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800"
      >
        <input
          placeholder="Nombre *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="TelÃ©fono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <div>
          <label className="text-xs text-zinc-400">ComisiÃ³n %</label>
          <input
            type="number"
            step="0.01"
            value={form.commissionPct}
            onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
          />
        </div>
        <button disabled={loading} className="btn-emerald">
          {loading ? "Guardando..." : "Agregar"}
        </button>
      </form>

      {/* Lista con editar/borrar */}
      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">TelÃ©fono</th>
              <th className="text-left p-2">Email</th>
              <th className="text-right p-2">ComisiÃ³n %</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t border-zinc-800/60">
                <td className="p-2">
                  {editingId === a.id ? (
                    <input
                      value={edit.name}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    />
                  ) : (
                    a.name
                  )}
                </td>
                <td className="p-2">
                  {editingId === a.id ? (
                    <input
                      value={edit.phone}
                      onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                    />
                  ) : (
                    a.phone || "-"
                  )}
                </td>
                <td className="p-2">
                  {editingId === a.id ? (
                    <input
                      value={edit.email}
                      onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                    />
                  ) : (
                    a.email || "-"
                  )}
                </td>
                <td className="p-2 text-right">
                  {editingId === a.id ? (
                    <input
                      className="text-right"
                      type="number"
                      step="0.01"
                      value={edit.commissionPct}
                      onChange={(e) => setEdit({ ...edit, commissionPct: e.target.value })}
                    />
                  ) : (
                    a.commissionPct?.toFixed(2)
                  )}
                </td>
                <td className="p-2 text-right space-x-2">
                  {editingId === a.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(a.id)}
                        className="rounded-lg border border-emerald-700/40 px-3 py-1 text-emerald-300 hover:bg-emerald-700/10"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border border-zinc-600/40 px-3 py-1 text-zinc-300 hover:bg-zinc-700/10"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => loadCommissions(a)}
                        className="rounded-lg border border-emerald-700/40 px-3 py-1 text-emerald-300 hover:bg-emerald-700/10"
                      >
                        Comisiones
                      </button>
                      <button
                        onClick={() => startEdit(a)}
                        className="rounded-lg border border-sky-700/40 px-3 py-1 text-sky-300 hover:bg-sky-700/10"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteAlliance(a.id)}
                        className="rounded-lg border border-red-600/40 px-3 py-1 text-red-300 hover:bg-red-700/10"
                      >
                        Borrar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-zinc-400">
                  No hay alianzas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Panel de comisiones */}
      {selected && comm && (
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-medium">Comisiones de {selected.name}</h2>
              <p className="text-zinc-400 text-sm">Porcentaje: {comm.pct.toFixed(2)}%</p>
            </div>
            <div className="text-right">
              <div className="text-zinc-400 text-xs">Saldo pendiente esperado</div>
              <div className="text-emerald-300 text-2xl font-semibold">
                ${(totalBalanceExpected / 100).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">CÃ³digo</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-right p-2">Base total</th>
                  <th className="text-right p-2">ComisiÃ³n esperada</th>
                  <th className="text-right p-2">Pagado</th>
                  <th className="text-right p-2">Saldo esperado</th>
                  <th className="text-right p-2 text-zinc-400">ComisiÃ³n s/cobrado</th>
                </tr>
              </thead>
              <tbody>
                {comm.rows.map((r) => (
                  <tr key={r.orderId} className="border-t border-zinc-800/60">
                    <td className="p-2">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="p-2">{r.code}</td>
                    <td className="p-2">{r.client}</td>
                    <td className="p-2 text-right">${(r.baseExpected / 100).toFixed(2)}</td>
                    <td className="p-2 text-right">${(r.accruedExpected / 100).toFixed(2)}</td>
                    <td className="p-2 text-right">${(r.paid / 100).toFixed(2)}</td>
                    <td className="p-2 text-right font-medium text-emerald-300">
                      ${(r.balanceExpected / 100).toFixed(2)}
                    </td>
                    <td className="p-2 text-right text-zinc-400">
                      ${(r.accruedCollected / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {comm.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-zinc-400">
                      Sin Ã³rdenes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Registrar pago */}
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 grid md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-zinc-400">Orden</label>
              <select
                value={payForm.orderId}
                onChange={(e) => setPayForm({ ...payForm, orderId: e.target.value })}
                className="w-full"
              >
                <option value="">ElegÃ­ ordenâ€¦</option>
                {comm.rows.map((r) => (
                  <option key={r.orderId} value={r.orderId}>
                    {r.code} â€” {r.client} â€” saldo ${(r.balanceExpected / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400">Importe</label>
              <input
                type="number"
                step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Fecha</label>
              <input
                type="date"
                value={payForm.date}
                onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
              />
            </div>
            <div className="md:col-span-5">
              <label className="text-xs text-zinc-400">Notas</label>
              <input
                value={payForm.notes}
                onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              />
            </div>
            <div className="md:col-span-5">
              <button onClick={registerPayment} className="btn-emerald">
                Registrar pago de comisiÃ³n
              </button>
            </div>
          </div>

          {/* Pagos realizados */}
          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="text-left p-2">Orden</th>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-right p-2">Importe</th>
                  <th className="text-left p-2">Notas</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {comm.rows.flatMap((r) =>
                  r.payments.map((p) => (
                    <tr key={p.id} className="border-top border-zinc-800/60">
                      <td className="p-2">{r.code}</td>
                      <td className="p-2">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="p-2 text-right">${(p.amount / 100).toFixed(2)}</td>
                      <td className="p-2">{p.notes || "-"}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => deletePayment(p.id)}
                          className="rounded-lg border border-red-600/40 px-3 py-1 text-red-300 hover:bg-red-700/10"
                        >
                          Anular
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {comm.rows.every((r) => r.payments.length === 0) && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-zinc-400">
                      Sin pagos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
