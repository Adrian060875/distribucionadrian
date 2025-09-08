"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ClientMini = { id: string; fullName: string };
type Row = {
  orderId: string; code: string; date: string;
  client: ClientMini;
  base: number; pct: number; due: number; paid: number; balance: number;
  payments: { id: string; amount: number; createdAt: string; notes?: string|null }[];
};
type Payload = {
  alliance: { id: string; name: string; commissionPct: number },
  orders: Row[],
  totals: { due: number; paid: number; balance: number }
};

export default function AllianceCommissionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, { amount: string; date: string; notes: string; saving?: boolean }>>({});

  const money = useMemo(() => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS"}), []);
  const onlyDigits = (s:string)=>s.replace(/[^\d]/g,"");

  async function load() {
    if (!id) return;
    setLoading(true);
    const r = await fetch(`/api/commissions/alliances/${id}`, { cache: "no-store" });
    setLoading(false);
    if (!r.ok) { alert("No se pudo cargar"); router.push("/admin/alliances"); return; }
    const json = await r.json() as Payload;
    setData(json);
    const today = new Date().toISOString().substring(0,10);
    const init: Record<string, any> = {};
    json.orders.forEach(o => { init[o.orderId] = { amount: String(Math.min(o.balance, o.due)), date: today, notes: "" }; });
    setForms(init);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function setForm(orderId: string, patch: Partial<{amount:string;date:string;notes:string; saving?:boolean}>) {
    setForms(prev => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function pay(orderId: string) {
    if (!data) return;
    const f = forms[orderId];
    const amt = parseInt(f?.amount || "0", 10) || 0; // en centavos (igual que vendedores)
    if (!amt || amt <= 0) { alert("Importe inválido"); return; }
    setForm(orderId, { saving: true });
    const r = await fetch("/api/commission-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ALLIANCE",
        orderId,
        allianceId: data.alliance.id,
        amount: amt,
        notes: f?.notes || undefined,
        createdAt: f?.date || undefined,
      }),
    });
    setForm(orderId, { saving: false });
    if (!r.ok) { alert("No se pudo registrar el pago"); return; }
    await load();
  }

  async function annul(paymentId: string) {
    if (!confirm("¿Anular este pago de comisión?")) return;
    const r = await fetch(`/api/commission-payments/${paymentId}`, { method: "DELETE" });
    if (!r.ok) { alert("No se pudo anular"); return; }
    await load();
  }

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!data) return <div className="p-6">Sin datos.</div>;

  return (
    <div className="p-6 grid gap-6">
      <div className="flex items-center justify-between">
        <a className="btn btn-ghost" href="/admin/alliances">← Alianzas</a>
        <h1 className="text-xl font-semibold">Comisiones — {data.alliance.name}</h1>
        <div className="card px-4 py-2">
          <div className="text-xs text-slate-400">Saldo total</div>
          <div className="text-lg font-bold text-amber-300">{money.format(data.totals.balance/100)}</div>
        </div>
      </div>

      <section className="card p-5 grid gap-4">
        <div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-6 bg-slate-900/40 rounded-lg p-3">
          <div className="flex justify-between"><span>% Comisión</span><b>{data.alliance.commissionPct}%</b></div>
          <div className="flex justify-between"><span>Total devengado</span><b>{money.format(data.totals.due/100)}</b></div>
          <div className="flex justify-between"><span>Pagado</span><b className="text-emerald-300">{money.format(data.totals.paid/100)}</b></div>
          <div className="flex justify-between"><span>Saldo</span><b className="text-amber-300">{money.format(data.totals.balance/100)}</b></div>
        </div>

        <div className="overflow-auto">
          <table className="table min-w-[980px]">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th className="text-right">Base</th>
                <th className="text-right">% </th>
                <th className="text-right">Devengado</th>
                <th className="text-right">Pagado</th>
                <th className="text-right">Saldo</th>
                <th className="text-right pr-2">Pagar / Pagos</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map(o => (
                <tr key={o.orderId}>
                  <td className="py-2">{o.code}</td>
                  <td>{new Date(o.date).toLocaleDateString()}</td>
                  <td><a className="link" href={`/admin/clients/${o.client.id}`}>{o.client.fullName}</a></td>
                  <td className="text-right">{money.format(o.base/100)}</td>
                  <td className="text-right">{o.pct}%</td>
                  <td className="text-right">{money.format(o.due/100)}</td>
                  <td className="text-right text-emerald-300">{money.format(o.paid/100)}</td>
                  <td className="text-right text-amber-300">{money.format(o.balance/100)}</td>
                  <td className="text-right">
                    <div className="flex gap-2 justify-end">
                      <input className="input w-28 text-right" inputMode="numeric"
                        value={forms[o.orderId]?.amount || "0"}
                        onChange={e=>setForm(o.orderId, { amount: onlyDigits(e.target.value) })} />
                      <input className="input w-36" type="date"
                        value={forms[o.orderId]?.date || new Date().toISOString().substring(0,10)}
                        onChange={e=>setForm(o.orderId, { date: e.target.value })} />
                      <input className="input w-40" placeholder="Notas"
                        value={forms[o.orderId]?.notes || ""}
                        onChange={e=>setForm(o.orderId, { notes: e.target.value })} />
                      <button className="btn btn-primary" onClick={()=>pay(o.orderId)} disabled={!!forms[o.orderId]?.saving}>
                        {forms[o.orderId]?.saving ? "Guardando…" : "Pagar"}
                      </button>
                    </div>
                    {o.payments.length > 0 && (
                      <div className="text-xs text-slate-400 mt-2 space-y-1">
                        {o.payments.map(p=>(
                          <div key={p.id} className="flex items-center justify-between gap-2">
                            <span>{new Date(p.createdAt).toLocaleDateString()} · {money.format(p.amount/100)} {p.notes ? `· ${p.notes}` : ""}</span>
                            <button className="btn btn-ghost" onClick={()=>annul(p.id)}>Anular</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
