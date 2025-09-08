"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Alliance = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  commissionPct: number;
};

type CommissionRow = {
  orderId: string;
  code: string;
  client: string;
  date: string;
  pct: number;
  // importes en CENTAVOS
  baseCollected: number;
  baseExpected: number;
  accruedCollected: number;
  accruedExpected: number;
  paid: number;
  balanceExpected?: number;
  payments: { id: string; amount: number; date: string; notes?: string }[];
};

export default function AlliancesPage() {
  // lista + alta
  const [list, setList] = useState<Alliance[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", commissionPct: "5" });
  const [loading, setLoading] = useState(false);

  // edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", phone: "", email: "", commissionPct: "0" });

  // comisiones
  const [selected, setSelected] = useState<Alliance | null>(null);
  const [comm, setComm] = useState<{ pct: number; rows: CommissionRow[] } | null>(null);
  const [payForm, setPayForm] = useState({
    orderId: "",
    amount: "", // PESOS (sin centavos)
    date: new Date().toISOString().substring(0, 10),
    notes: "",
  });

  const money = useMemo(() => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }), []);

  // ===== Helpers =====
  function onlyDigits(s: string) {
    return s.replace(/[^\d]/g, "");
  }

  function rowById(orderId: string) {
    return comm?.rows.find((r) => r.orderId === orderId);
  }

  function balanceCents(orderId: string) {
    const r = rowById(orderId);
    if (!r) return 0;
    const cents = typeof r.balanceExpected === "number"
      ? r.balanceExpected
      : Math.max((r.accruedExpected ?? 0) - (r.paid ?? 0), 0);
    return Math.max(cents, 0);
  }

  function defaultAmountFor(orderId: string) {
    const cents = balanceCents(orderId);
    return String(Math.floor(cents / 100));
  }

  // ===== Data =====
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

  // ===== CRUD =====
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
      await loadCommissions({ ...selected, name: edit.name, phone: edit.phone, email: edit.email, commissionPct: Number(edit.commissionPct || "0") });
    }
  }
  async function deleteAlliance(id: string) {
    if (!confirm("¿Borrar alianza? Esta acción no se puede deshacer.")) return;
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

  // ===== Comisiones =====
  async function loadCommissions(a: Alliance) {
    setSelected(a);
    setComm(null);
    const r = await fetch(`/api/commissions?allianceId=${a.id}`, { cache: "no-store" });
    if (!r.ok) {
      alert("No se pudo calcular comisiones");
      return;
    }
    setComm(await r.json());
    setPayForm((p) => ({ ...p, orderId: "", amount: "" })); // se completa al elegir la orden
  }

  async function registerPayment() {
    if (!selected || !payForm.orderId) return;

    const amtPesos = parseInt(payForm.amount || "0", 10) || 0;
    if (!amtPesos || amtPesos <= 0) {
      alert("Importe inválido");
      return;
    }

    const saldoPesosMax = Math.floor(balanceCents(payForm.orderId) / 100);
    const safePesos = Math.min(amtPesos, saldoPesosMax);

    const r = await fetch("/api/commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "ALLIANCE",
        allianceId: selected.id,
        orderId: payForm.orderId,
        amount: safePesos * 100, // centavos
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

  async function deletePayment(id: string) {
    const r = await fetch(`/api/commissions?id=${id}`, { method: "DELETE" });
    if (!r.ok) {
      alert("No se pudo anular");
      return;
    }
    if (selected) loadCommissions(selected);
  }

  // Total saldo esperado (centavos) robusto
  const totalBalanceExpected = useMemo(() => {
    if (!comm) return 0;
    return comm.rows.reduce((a, r) => {
      const bal = typeof r.balanceExpected === "number" ? r.balanceExpected : Math.max((r.accruedExpected ?? 0) - (r.paid ?? 0), 0);
      return a + Math.max(bal, 0);
    }, 0);
  }, [comm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="rounded-lg border border-emerald-700/40 px-3 py-1.5 text-emerald-300 hover:bg-emerald-700/10">
          ← Volver
        </Link>
        <h1 className="text-2xl font-semibold">Alianzas</h1>
      </div>

      {/* Alta rápida */}
      <form onSubmit={createAlliance} className="grid md:grid-cols-5 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <input placeholder="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div>
          <label className="text-xs text-zinc-400">Comisión %</label>
          <input type="number" step="0.01" value={form.commissionPct} onChange={(e) => setForm({ ...form, commissionPct: e.target.value })} />
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
              <th className="text-left p-2">Teléfono</th>
              <th className="text-left p-2">Email</th>
              <th className="text-right p-2">Comisión %</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t border-zinc-800/60">
                <td className="p-2">{editingId === a.id ? <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /> : a.name}</td>
                <td className="p-2">{editingId === a.id ? <input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /> : a.phone || "-"}</td>
                <td className="p-2">{editingId === a.id ? <input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /> : a.email || "-"}</td>
                <td className="p-2 text-right">
                  {editingId === a.id ? (
                    <input className="text-right" type="number" step="0.01" value={edit.commissionPct} onChange={(e) => setEdit({ ...edit, commissionPct: e.target.value })} />
                  ) : (
                    a.commissionPct?.toFixed(2)
                  )}
                </td>
                <td className="p-2 text-right space-x-2">
                  {editingId === a.id ? (
                    <>
                      <button onClick={() => saveEdit(a.id)} className="rounded-lg border border-emerald-700/40 px-3 py-1 text-emerald-300 hover:bg-emerald-700/10">
                        Guardar
                      </button>
                      <button onClick={cancelEdit} className="rounded-lg border border-zinc-600/40 px-3 py-1 text-zinc-300 hover:bg-zinc-700/10">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => loadCommissions(a)} className="rounded-lg border border-emerald-700/40 px-3 py-1 text-emerald-300 hover:bg-emerald-700/10">
                        Comisiones
                      </button>
                      <button onClick={() => startEdit(a)} className="rounded-lg border border-sky-700/40 px-3 py-1 text-sky-300 hover:bg-sky-700/10">
                        Editar
                      </button>
                      <button onClick={() => deleteAlliance(a.id)} className="rounded-lg border border-red-600/40 px-3 py-1 text-red-300 hover:bg-red-700/10">
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
              <div className="text-emerald-300 text-2xl font-semibold">{money.format(totalBalanceExpected / 100)}</div>
            </div>
          </div>

          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 grid md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-zinc-400">Orden</label>
              <select
                value={payForm.orderId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPayForm((p) => ({
                    ...p,
                    orderId: id,
                    amount: id ? defaultAmountFor(id) : "",
                  }));
                }}
                className="w-full"
              >
                <option value="">Elegí orden…</option>
                {comm.rows.map((r) => (
                  <option key={r.orderId} value={r.orderId}>
                    {r.code} — {r.client} — saldo {money.format(balanceCents(r.orderId) / 100)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400">Importe (pesos)</label>
              <input
                className="input w-28 text-right"
                inputMode="numeric"
                placeholder="Pesos"
                value={payForm.amount}
                onChange={(e) => setPayForm((p) => ({ ...p, amount: onlyDigits(e.target.value) }))}
                title="Importe en pesos (sin centavos)"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Fecha</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="md:col-span-5">
              <label className="text-xs text-zinc-400">Notas</label>
              <input value={payForm.notes} onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="md:col-span-5">
              <button onClick={registerPayment} className="btn-emerald">
                Registrar pago de comisión
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
                      <td className="p-2 text-right">{money.format(p.amount / 100)}</td>
                      <td className="p-2">{p.notes || "-"}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => deletePayment(p.id)} className="rounded-lg border border-red-600/40 px-3 py-1 text-red-300 hover:bg-red-700/10">
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
