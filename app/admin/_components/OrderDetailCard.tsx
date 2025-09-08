"use client";

import { useEffect, useMemo, useState } from "react";

type FinancingPlan = { id: string; name: string; months: number; interestPct: number };
type OrderItem = { productId?: string; product?: { id: string; name: string } | null; unitPrice: number; quantity: number };
type Order = {
  id: string;
  code: string;
  createdAt?: string;
  items: OrderItem[];
  discount: number;      // centavos
  downPayment: number;   // centavos
  coinpay?: number;      // centavos (puede no venir, lo toleramos)
  totalFinal?: number;   // centavos
  financingPlanId?: string | null;
  financingPlan?: FinancingPlan | null;
};

function moneyFmt(cents: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format((cents || 0) / 100);
}

export default function OrderDetailCard({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [plan, setPlan] = useState<FinancingPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // orden
        const r = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (!j) { setOrder(null); setLoading(false); return; }
        setOrder(j);

        // plan (si corresponde): tolera backend con distintas rutas
        const pid = j.financingPlanId ?? j.financingPlan?.id ?? null;
        if (pid) {
          let p: any = null;
          try {
            const r1 = await fetch(`/api/financing-plans/${pid}`, { cache: "no-store" });
            if (r1.ok) p = await r1.json();
          } catch {}
          if (!p) {
            try {
              const r2 = await fetch(`/api/plans/${pid}`, { cache: "no-store" });
              if (r2.ok) p = await r2.json();
            } catch {}
          }
          if (p && p.id) setPlan({ id: p.id, name: p.name, months: Number(p.months || 0), interestPct: Number(p.interestPct || 0) });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const totals = useMemo(() => {
    if (!order) return null;

    const itemsTotal = (order.items || []).reduce((acc, it) => acc + (it.unitPrice || 0) * (it.quantity || 0), 0);
    const discount = order.discount || 0;
    const down = order.downPayment || 0;
    const coin = order.coinpay || 0;

    // Base a financiar = mercadería − descuento − (anticipo + coinpay)
    const baseFinance = Math.max(itemsTotal - discount - (down + coin), 0);

    // Interés según plan (preview en caso de que el backend no lo haya guardado)
    const interest = plan ? Math.round(baseFinance * (plan.interestPct || 0) / 100) : 0;

    // A financiar = base + interés
    const toFinance = baseFinance + interest;

    // Total final = (anticipo + coinpay) + base + interés
    // Si backend ya guardó totalFinal, lo respetamos
    const final = typeof order.totalFinal === "number" ? order.totalFinal : (down + coin + baseFinance + interest);

    return { itemsTotal, discount, down, coin, baseFinance, interest, toFinance, final };
  }, [order, plan]);

  const schedule = useMemo(() => {
    if (!totals || !plan || !plan.months || plan.months <= 0) return [];
    const base = totals.toFinance;
    if (!base) return [];
    const m = plan.months;

    const quota = Math.floor(base / m);
    const remainder = base - quota * m;

    const first = new Date();
    first.setHours(0, 0, 0, 0);
    first.setMonth(first.getMonth() + 1);

    return Array.from({ length: m }).map((_, i) => {
      const due = new Date(first);
      due.setMonth(first.getMonth() + i);
      const amount = i === m - 1 ? quota + remainder : quota;
      return { n: i + 1, due: due.toLocaleDateString(), amount };
    });
  }, [totals, plan]);

  if (loading) return <div className="rounded-xl border border-zinc-800 p-3 text-zinc-400">Cargando orden…</div>;
  if (!order || !totals) return <div className="rounded-xl border border-zinc-800 p-3 text-zinc-400">No se pudo cargar la orden.</div>;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="font-semibold">
          Orden <span className="text-emerald-300">#{order.code}</span>
          <span className="text-zinc-400 text-sm ml-2">{order.createdAt ? new Date(order.createdAt).toLocaleString("es-AR") : ""}</span>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-2">
          <div className="text-xs text-zinc-400">Total final</div>
          <div className="text-xl font-bold text-amber-300">{moneyFmt(totals.final)}</div>
        </div>
      </div>

      {/* Ítems */}
      <div className="overflow-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="p-2 text-left">Producto</th>
              <th className="p-2 text-right">Cant.</th>
              <th className="p-2 text-right">Precio</th>
              <th className="p-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((it, i) => {
              const sub = (it.unitPrice || 0) * (it.quantity || 0);
              return (
                <tr key={i} className="border-t border-zinc-800/60">
                  <td className="p-2">{it.product?.name || it.productId || "—"}</td>
                  <td className="p-2 text-right">{it.quantity || 0}</td>
                  <td className="p-2 text-right">{moneyFmt(it.unitPrice || 0)}</td>
                  <td className="p-2 text-right">{moneyFmt(sub)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-800/60">
              <td className="p-2 text-right font-medium" colSpan={3}>Mercadería</td>
              <td className="p-2 text-right font-medium">{moneyFmt(totals.itemsTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Financiación */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border p-3">
          <div className="text-xs text-zinc-400 mb-1">Plan de financiación</div>
          <div className="text-sm">
            {plan
              ? `${plan.name} • ${plan.months} cuotas • ${plan.interestPct}%`
              : (order.financingPlanId || order.financingPlan ? "Plan no encontrado" : "Sin plan")}
          </div>
        </div>

        <div className="rounded-2xl border p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Mercadería</span><b>{moneyFmt(totals.itemsTotal)}</b></div>
          <div className="flex justify-between"><span>Descuento</span><b>− {moneyFmt(totals.discount)}</b></div>
          <div className="flex justify-between"><span>Anticipo</span><b>− {moneyFmt(totals.down)}</b></div>
          <div className="flex justify-between"><span>Coinpay</span><b>− {moneyFmt(totals.coin)}</b></div>
          <div className="flex justify-between"><span>Base a financiar</span><b>{moneyFmt(totals.baseFinance)}</b></div>
          {plan && <div className="flex justify-between"><span>Interés ({plan.interestPct}%)</span><b>{moneyFmt(totals.interest)}</b></div>}
          <div className="flex justify-between border-t pt-1 mt-1 text-base"><span>Total final</span><b className="text-amber-300">{moneyFmt(totals.final)}</b></div>
          {plan && <div className="flex justify-between"><span>A financiar</span><b>{moneyFmt(totals.toFinance)}</b></div>}
        </div>

        <div className="rounded-2xl border p-3 overflow-auto">
          <div className="text-xs text-zinc-400 mb-1">Cronograma</div>
          {schedule.length === 0 ? (
            <div className="text-zinc-400 text-sm">Sin cuotas (contado o plan sin meses)</div>
          ) : (
            <table className="min-w-[420px] w-full text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Vencimiento</th>
                  <th className="p-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map(r => (
                  <tr key={r.n} className="border-t border-zinc-800/60">
                    <td className="p-2">{r.n}</td>
                    <td className="p-2">{r.due}</td>
                    <td className="p-2 text-right">{moneyFmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
