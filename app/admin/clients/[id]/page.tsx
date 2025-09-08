"use client";

import { useEffect, useMemo, useState } from "react";

/* ===================== Tipos ===================== */
type Payment = {
  id: string;
  amount: number;                 // centavos
  method?: string | null;         // "CASH" | "CARD" | "TRANSFER"
  reference?: string | null;
  createdAt: string;              // ISO
};

type ProductMini = { id: string; name: string; sku?: string | null };

type Item = {
  id: string;
  quantity: number;
  unitPrice: number;              // centavos
  product?: ProductMini | null;
};

type Instalment = {
  id: string;
  number: number;
  dueDate: string;                // ISO
  amount: number;                 // centavos
  isPaid?: boolean | null;
  paidAt?: string | null;
};

type Plan = { id: string; name: string; months: number; interestPct: number };

type Party = {
  id: string;
  name: string;
  commissionPct?: number | null;      // % (ej: 5 = 5%)
  commissionAmount?: number | null;   // centavos
};

type Order = {
  id: string;
  code: string;
  createdAt: string;
  downPayment: number;            // anticipo (centavos)
  coinpay?: number | null;        // coinpay (centavos, opcional)
  totalList: number;              // suma items (centavos)
  totalToFinance?: number | null;
  totalFinal?: number | null;     // total a pagar (si el backend lo guarda)
  discount?: number | null;       // descuento (centavos)
  items: Item[];
  payments: Payment[];
  instalments: Instalment[];      // cronograma
  financingPlan?: Plan | null;

  seller?: Party | null;
  alliance?: Party | null;

  // Alternativos por si vienen fuera de seller/alliance
  sellerCommissionPct?: number | null;
  sellerCommissionAmount?: number | null;     // centavos
  allianceCommissionPct?: number | null;
  allianceCommissionAmount?: number | null;   // centavos

  // Posibles variantes crudas que toleramos (por compatibilidad)
  allianceId?: string | null;
  alliance_id?: string | null;
  allianceName?: string | null;
  alliancePct?: number | null;
  alliance_amount?: number | null;
  alliance_fee_pct?: number | null;
  alliance_fee_amount?: number | null;

  computed?: {
    discount?: number;
    paidTotal?: number;
    paidExcludingDown?: number;
    balance?: number;
  };
};

type Client = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdAt: string;
  orders: Order[];
};

/* ===================== Helpers de formato ===================== */
function pesos(cents: number | undefined | null) {
  const v = Math.round(Number(cents || 0)) / 100;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}
function getDiscount(o: Order) {
  if (typeof o?.computed?.discount === "number") return Math.max(o.computed!.discount!, 0);
  if (typeof o?.discount === "number") return Math.max(o.discount!, 0);
  return 0;
}
function getPaidTotal(o: Order) {
  if (typeof o?.computed?.paidTotal === "number") return o.computed!.paidTotal!;
  return (o.payments || []).reduce((a, p) => a + (p.amount || 0), 0);
}
function getPaidExcludingDown(o: Order) {
  if (typeof o?.computed?.paidExcludingDown === "number") return Math.max(o.computed!.paidExcludingDown!, 0);
  // Excluimos solo anticipo; Coinpay descuenta base (no cuenta como pago del cliente)
  return Math.max(getPaidTotal(o) - (o.downPayment || 0), 0);
}

/** 🔁 Misma fórmula que en “Nueva/Editar orden” (incluye Coinpay) */
function computeDerived(o: Order) {
  const itemsTotal = o.totalList || 0;
  const discount = getDiscount(o);
  const down = o.downPayment || 0;
  const coin = Math.max(Number(o.coinpay || 0), 0);

  // Base = mercadería − descuento − (anticipo + coinpay)
  const baseFinance = Math.max(itemsTotal - discount - (down + coin), 0);

  // Interés del plan (si hay)
  const interest = o.financingPlan ? Math.round(baseFinance * (o.financingPlan.interestPct || 0) / 100) : 0;

  // A financiar + Total final (si backend no lo guardó, se recompone)
  const toFinance = baseFinance + interest;
  const final = (typeof o.totalFinal === "number") ? o.totalFinal! : (down + coin + baseFinance + interest);

  return { itemsTotal, discount, down, coin, baseFinance, interest, toFinance, final };
}

function getBalance(o: Order) {
  const d = computeDerived(o);
  if (typeof o?.computed?.balance === "number") return Math.max(o.computed!.balance!, 0);
  // Saldo = Total final − pagos (sin anticipo)
  return Math.max(d.final - getPaidExcludingDown(o), 0);
}

/** Determina % y $ de comisión a mostrar (prioridad a montos provistos) */
function getCommissionDisplay(
  o: Order,
  party: "seller" | "alliance",
  itemsTotalForFallback: number
): { pct?: number | null; amount?: number | null } {
  const p = o[party] || null;

  const pct =
    (p?.commissionPct ?? null) ??
    (party === "seller" ? o.sellerCommissionPct ?? null : o.allianceCommissionPct ?? null);

  const amount =
    (p?.commissionAmount ?? null) ??
    (party === "seller" ? o.sellerCommissionAmount ?? null : o.allianceCommissionAmount ?? null);

  if ((amount == null || Number.isNaN(amount)) && typeof pct === "number") {
    const est = Math.round((itemsTotalForFallback * pct) / 100);
    return { pct, amount: est };
  }
  return { pct: pct ?? undefined, amount: amount ?? undefined };
}

/* ===================== Cobranza según tipo de financiación ===================== */
type FinanceHandling = "OWN" | "CARD_OR_BANK" | "COMPANY" | "CASH" | "UNKNOWN";

function detectFinanceHandling(o: Order): { kind: FinanceHandling } {
  const t = (o as any).financingType ?? (o.financingPlan as any)?.type ?? "";
  const name = (o.financingPlan?.name || "").toLowerCase();

  // Campos explícitos (si existen)
  if (typeof t === "string" && t) {
    const T = t.toUpperCase();
    if (T.includes("OWN") || T.includes("PROPI")) return { kind: "OWN" };
    if (T.includes("CARD") || T.includes("TARJ")) return { kind: "CARD_OR_BANK" };
    if (T.includes("COMPANY") || T.includes("EMPRESA") || T.includes("ROYAL")) return { kind: "COMPANY" };
  }

  // Inferencia por nombre del plan
  if (/(tarjeta|visa|master|amex|cr[eé]dito|d[eé]bito|posnet|naranja|cabal|mercado\s?pago|mp)/i.test(name)) {
    return { kind: "CARD_OR_BANK" };
  }
  if (/(empresa|royal|financiaci[oó]n empresa|financiado empresa)/i.test(name)) {
    return { kind: "COMPANY" };
  }
  if (/(propia|propio|intern[oa]|in[- ]?house|cuenta corriente)/i.test(name)) {
    return { kind: "OWN" };
  }

  // Sin plan => contado
  if (!o.financingPlan) return { kind: "CASH" };

  return { kind: "UNKNOWN" };
}

function paymentsAllowed(o: Order) {
  return detectFinanceHandling(o).kind === "OWN";
}
function collectionBadge(o: Order) {
  const { kind } = detectFinanceHandling(o);
  if (kind === "OWN") return { text: "Cobranza: Interna", cls: "bg-emerald-900/30 border-emerald-700/40 text-emerald-200" };
  if (kind === "CARD_OR_BANK" || kind === "COMPANY") return { text: "Cobranza: Banco", cls: "bg-amber-900/20 border-amber-700/40 text-amber-200" };
  if (kind === "CASH") return { text: "Contado", cls: "bg-neutral-800/60 border-neutral-700 text-neutral-200" };
  return { text: "Cobranza", cls: "bg-neutral-800/60 border-neutral-700 text-neutral-300" };
}

/* ===================== Página ===================== */
export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [data, setData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // edición in-line de pagos
  const [editingPay, setEditingPay] = useState<Record<string, { amount: string; method: string; reference: string; date: string }>>({});
  const [savingPayId, setSavingPayId] = useState<string | null>(null);
  const [deletingPayId, setDeletingPayId] = useState<string | null>(null);

  // formulario “Registrar pago”
  const [payForms, setPayForms] = useState<Record<string, { amount: string; method: string; reference: string; date: string; instalmentId?: string }>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await fetch(`/api/clients/${id}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${r.status}`);
      }
      const j = (await r.json()) as Client;

      // Normalizamos colecciones
      const orders = Array.isArray(j.orders) ? j.orders : [];
      j.orders = orders.map((o) => ({
        ...o,
        items: Array.isArray(o.items) ? o.items : [],
        payments: Array.isArray(o.payments) ? o.payments : [],
        instalments: Array.isArray(o.instalments) ? o.instalments : [],
      }));

      setData(j);

      // Inicializa forms de “Registrar pago”
      setPayForms((prev) => {
        const next = { ...prev };
        j.orders.forEach((o) => {
          if (!next[o.id]) {
            next[o.id] = {
              amount: "",
              method: "CASH",
              reference: "",
              date: new Date().toISOString().substring(0, 10),
              instalmentId: undefined,
            };
          }
        });
        return next;
      });
    } catch (e: any) {
      console.error("CLIENT DETAIL ERROR:", e);
      setErrorMsg("No se pudo cargar el cliente.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const clientTotalBalance = useMemo(() => {
    if (!data) return 0;
    return (data.orders || []).reduce((acc, o) => acc + getBalance(o), 0);
  }, [data]);

  const inputCls =
    "w-full rounded-md bg-white text-zinc-900 border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600";
  const selectCls =
    "w-full rounded-md bg-white text-zinc-900 border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600";
  const btnCls =
    "inline-flex items-center rounded-md border border-emerald-600/40 bg-transparent hover:bg-emerald-700/10 px-3 py-2 text-sm font-medium text-emerald-300";

  // helpers pagos
  function beginEditPayment(p: Payment) {
    setEditingPay((prev) => ({
      ...prev,
      [p.id]: {
        amount: String(p.amount ?? 0),
        method: p.method || "CASH",
        reference: p.reference || "",
        date: (p.createdAt || "").substring(0, 10) || new Date().toISOString().substring(0, 10),
      },
    }));
  }
  function cancelEditPayment(id: string) {
    setEditingPay((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }
  async function saveEditPayment(id: string) {
    const form = editingPay[id];
    if (!form) return;

    const cents = Number(String(form.amount).replaceAll(".", "").replaceAll(",", ""));
    if (!Number.isFinite(cents) || cents <= 0) {
      alert("Importe inválido");
      return;
    }

    setSavingPayId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cents,
          method: form.method,
          reference: form.reference || undefined,
          date: form.date ? new Date(form.date).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      await load();
      cancelEditPayment(id);
    } catch (e: any) {
      console.error("EDIT PAYMENT ERROR:", e);
      alert(e?.message || "No se pudo guardar el pago");
    } finally {
      setSavingPayId(null);
    }
  }
  async function deletePayment(id: string) {
    if (!confirm("¿Eliminar este pago?")) return;
    setDeletingPayId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e: any) {
      console.error("DELETE PAYMENT ERROR:", e);
      alert(e?.message || "No se pudo eliminar el pago");
    } finally {
      setDeletingPayId(null);
    }
  }

  function setForm(orderId: string, patch: Partial<{ amount: string; method: string; reference: string; date: string; instalmentId?: string }>) {
    setPayForms((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }
  function onPickInstalment(order: Order, instalmentId: string) {
    const ins = order.instalments.find((i) => i.id === instalmentId);
    if (!ins) { setForm(order.id, { instalmentId: undefined }); return; }
    setForm(order.id, { instalmentId, amount: String(ins.amount) });
  }
  async function submitPayment(orderId: string, order: Order) {
    // 🚫 Bloqueo si no corresponde registrar pagos aquí
    if (!paymentsAllowed(order)) {
      alert("Esta orden se cobra por el banco/empresa o es contado. No corresponde registrar pagos aquí.");
      return;
    }

    const form = payForms[orderId];
    if (!form) return;

    const cents = Number(String(form.amount).replaceAll(".", "").replaceAll(",", ""));
    if (!Number.isFinite(cents) || cents <= 0) { alert("Importe inválido"); return; }

    setSubmittingOrderId(orderId);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          amount: cents,
          method: form.method || "CASH",
          reference: form.reference || undefined,
          date: form.date ? new Date(form.date).toISOString() : undefined,
          instalmentId: form.instalmentId || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      await load();
      setPayForms((prev) => ({
        ...prev,
        [orderId]: {
          amount: "",
          method: prev[orderId]?.method || "CASH",
          reference: "",
          date: new Date().toISOString().substring(0, 10),
          instalmentId: undefined,
        },
      }));
    } catch (e: any) {
      console.error("PAYMENT ERROR:", e);
      alert(e?.message || "Error registrando el pago");
    } finally {
      setSubmittingOrderId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f0d] text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">

        {/* Header cliente */}
        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">Cargando…</div>
        )}
        {!loading && errorMsg && (
          <div className="rounded-2xl border border-red-800/50 bg-red-900/20 p-6 text-red-200">{errorMsg}</div>
        )}

        {!loading && data && (
          <>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-emerald-300">{data.fullName}</h1>
                  <p className="text-zinc-400 text-sm mt-1">
                    {data.phone || "-"} · {data.email || "-"}
                  </p>
                </div>
                <a
                  href="/admin/clients"
                  className="rounded-lg border border-emerald-700/40 px-3 py-1.5 text-emerald-300 hover:bg-emerald-700/10 text-sm"
                >
                  ← Volver
                </a>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl bg-black/40 p-3 border border-neutral-800">
                  <div className="text-xs text-zinc-400">Saldo total adeudado</div>
                  <div className="text-2xl mt-1 font-semibold tabular-nums text-amber-300">
                    {pesos(clientTotalBalance)}
                  </div>
                </div>
              </div>

              {data.address && <p className="text-zinc-300 mt-2">{data.address}</p>}
              {data.birthDate && (
                <p className="text-zinc-400 text-sm mt-1">
                  Nacimiento: {new Date(data.birthDate).toLocaleDateString("es-AR")}
                </p>
              )}
              {data.notes && <p className="text-zinc-300 mt-2 italic">{data.notes}</p>}
            </div>

            {/* Órdenes del cliente */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Órdenes del cliente</h2>

              {data.orders.length === 0 && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-400">
                  No hay órdenes para este cliente.
                </div>
              )}

              {data.orders.map((o) => {
                const { itemsTotal, discount, down, coin, baseFinance, interest, toFinance, final } = computeDerived(o);
                const hasPlan = !!o.financingPlan;

                // Comisiones
                const sellerComm = getCommissionDisplay(o, "seller", Math.max(itemsTotal - discount, 0));
                const allianceComm = getCommissionDisplay(o, "alliance", Math.max(itemsTotal - discount, 0));

                const form = payForms[o.id] || {
                  amount: "",
                  method: "CASH",
                  reference: "",
                  date: new Date().toISOString().substring(0, 10),
                  instalmentId: undefined,
                };

                const canApplyPayments = paymentsAllowed(o);
                const colBadge = collectionBadge(o);

                return (
                  <div key={o.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
                    {/* Encabezado de la orden */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-sm text-zinc-400">Orden</div>
                        <div className="text-xl font-semibold flex items-center gap-2 flex-wrap">
                          <span>{o.code} · {new Date(o.createdAt).toLocaleDateString("es-AR")}</span>
                          <span className={`text-xs rounded-md border px-2 py-0.5 ${colBadge.cls}`}>{colBadge.text}</span>
                        </div>

                        {/* Vendedor / Alianza + comisiones */}
                        <div className="text-sm text-zinc-400 flex flex-col sm:flex-row sm:gap-4">
                          <span>
                            {o.seller?.name ? (
                              <>
                                Vendedor: {o.seller.name}
                                {(sellerComm.pct != null || sellerComm.amount != null) && (
                                  <> — <span className="text-zinc-300">
                                    {sellerComm.pct != null ? `${sellerComm.pct}%` : ""}
                                    {sellerComm.pct != null && sellerComm.amount != null ? " • " : ""}
                                    {sellerComm.amount != null ? `${pesos(sellerComm.amount)}` : ""}
                                  </span></>
                                )}
                              </>
                            ) : "Vendedor: —"}
                          </span>

                          <span>
                            {o.alliance?.name ? (
                              <>
                                Alianza: {o.alliance.name}
                                {(allianceComm.pct != null || allianceComm.amount != null) && (
                                  <> — <span className="text-zinc-300">
                                    {allianceComm.pct != null ? `${allianceComm.pct}%` : ""}
                                    {allianceComm.pct != null && allianceComm.amount != null ? " • " : ""}
                                    {allianceComm.amount != null ? `${pesos(allianceComm.amount)}` : ""}
                                  </span></>
                                )}
                              </>
                            ) : "Alianza: —"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-neutral-800 bg-black px-4 py-2">
                        <div className="text-xs text-zinc-400">Total final</div>
                        <div className="text-xl font-bold text-amber-300">{pesos(final)}</div>
                      </div>
                    </div>

                    {/* Ítems */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-zinc-400">
                          <tr>
                            <th className="px-3 py-1 text-left">Producto</th>
                            <th className="px-3 py-1 text-left">SKU</th>
                            <th className="px-3 py-1 text-right">Cant.</th>
                            <th className="px-3 py-1 text-right">Unitario</th>
                            <th className="px-3 py-1 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items.map((it) => {
                            const name = it.product?.name ?? "-";
                            const sku = it.product?.sku ?? "";
                            const unit = it.unitPrice || 0;
                            const sub = unit * (it.quantity || 0);
                            return (
                              <tr key={it.id} className="border-t border-zinc-800/60">
                                <td className="px-3 py-1">{name}</td>
                                <td className="px-3 py-1">{sku}</td>
                                <td className="px-3 py-1 text-right">{it.quantity}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{pesos(unit)}</td>
                                <td className="px-3 py-1 text-right tabular-nums">{pesos(sub)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-zinc-800/60">
                            <td className="px-3 py-1 text-right font-medium" colSpan={4}>Mercadería</td>
                            <td className="px-3 py-1 text-right font-medium">{pesos(itemsTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Resumen financiero */}
                    <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
                      <Card label="Total productos" value={itemsTotal} />
                      <Card label="(-) Descuento" value={discount} />
                      <Card label="(-) Anticipo" value={down} />
                      <Card label="(-) Coinpay" value={coin} />
                      <Card label="Base a financiar" value={baseFinance} />
                      {hasPlan && <Card label={`Interés (${o.financingPlan!.interestPct}%)`} value={interest} />}
                      <Card label={hasPlan ? "A financiar" : "A pagar"} value={hasPlan ? toFinance : baseFinance} />
                      <Card label="Total final" value={final} highlight />
                    </div>

                    {/* Plan + Cronograma */}
                    {hasPlan && (
                      <div className="rounded-xl bg-black/40 p-3 border border-neutral-800">
                        <div className="text-sm text-zinc-300 mb-2">
                          {o.financingPlan!.name} — {o.financingPlan!.months} cuotas
                        </div>

                        {(o.instalments?.length ?? 0) === 0 ? (
                          <div className="text-zinc-400 text-sm">No hay cuotas registradas para esta orden.</div>
                        ) : (
                          <ul className="space-y-2">
                            {o.instalments
                              .slice()
                              .sort((a, b) => a.number - b.number)
                              .map((ins) => (
                                <li
                                  key={ins.id}
                                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                                    ins.isPaid
                                      ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-200"
                                      : "bg-neutral-900/40 border-neutral-700 text-neutral-200"
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-sm">
                                      Cuota #{ins.number} — {new Date(ins.dueDate).toLocaleDateString("es-AR")}
                                    </span>
                                    {ins.isPaid && ins.paidAt && (
                                      <span className="text-xs text-emerald-300/80">
                                        Pagada el {new Date(ins.paidAt).toLocaleDateString("es-AR")}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right tabular-nums">{pesos(ins.amount)}</div>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Pagos (LISTA) */}
                    <div className="rounded-xl bg-black/40 p-3 border border-neutral-800">
                      <div className="text-xs text-zinc-400 mb-1">Pagos</div>

                      {(o.payments?.length ?? 0) === 0 ? (
                        <div className="text-zinc-400 text-sm">Sin pagos registrados.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                            <thead className="text-zinc-300">
                              <tr className="text-left">
                                <th className="px-3 py-1">Fecha</th>
                                <th className="px-3 py-1">Método</th>
                                <th className="px-3 py-1">Ref.</th>
                                <th className="px-3 py-1 text-right">Importe</th>
                                <th className="px-3 py-1 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o.payments
                                .slice()
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map((p) => {
                                  const ed = editingPay[p.id];
                                  const isEditing = !!ed;

                                  return (
                                    <tr key={p.id} className="bg-neutral-900/50 align-top">
                                      <td className="px-3 py-1">
                                        {isEditing ? (
                                          <input
                                            type="date"
                                            className={inputCls}
                                            value={ed.date}
                                            onChange={(e) =>
                                              setEditingPay((prev) => ({
                                                ...prev,
                                                [p.id]: { ...prev[p.id], date: e.target.value },
                                              }))
                                            }
                                          />
                                        ) : (
                                          new Date(p.createdAt).toLocaleDateString("es-AR")
                                        )}
                                      </td>

                                      <td className="px-3 py-1">
                                        {isEditing ? (
                                          <select
                                            className={selectCls}
                                            value={ed.method}
                                            onChange={(e) =>
                                              setEditingPay((prev) => ({
                                                ...prev,
                                                [p.id]: { ...prev[p.id], method: e.target.value },
                                              }))
                                            }
                                          >
                                            <option value="CASH">Efectivo</option>
                                            <option value="CARD">Tarjeta</option>
                                            <option value="TRANSFER">Transferencia</option>
                                          </select>
                                        ) : (
                                          p.method || "-"
                                        )}
                                      </td>

                                      <td className="px-3 py-1">
                                        {isEditing ? (
                                          <input
                                            className={inputCls}
                                            value={ed.reference}
                                            onChange={(e) =>
                                              setEditingPay((prev) => ({
                                                ...prev,
                                                [p.id]: { ...prev[p.id], reference: e.target.value },
                                              }))
                                            }
                                          />
                                        ) : (
                                          p.reference || "-"
                                        )}
                                      </td>

                                      <td className="px-3 py-1 text-right tabular-nums">
                                        {isEditing ? (
                                          <input
                                            className={inputCls + " text-right"}
                                            inputMode="numeric"
                                            value={ed.amount}
                                            onChange={(e) =>
                                              setEditingPay((prev) => ({
                                                ...prev,
                                                [p.id]: { ...prev[p.id], amount: e.target.value },
                                              }))
                                            }
                                          />
                                        ) : (
                                          pesos(p.amount)
                                        )}
                                      </td>

                                      <td className="px-3 py-1 text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                          <button
                                            className="inline-flex items-center rounded-md bg-neutral-700 hover:bg-neutral-600 px-3 py-2 text-sm disabled:opacity-50"
                                            disabled={!canApplyPayments}
                                            title={canApplyPayments ? "Editar pago" : "Cobranza por banco/contado: edición deshabilitada"}
                                            onClick={() => canApplyPayments && beginEditPayment(p)}
                                          >
                                            Editar
                                          </button>
                                          <button
                                            className="inline-flex items-center rounded-md bg-red-700 hover:bg-red-600 px-3 py-2 text-sm disabled:opacity-50"
                                            disabled={!canApplyPayments}
                                            title={canApplyPayments ? "Eliminar pago" : "Cobranza por banco/contado: eliminación deshabilitada"}
                                            onClick={() => canApplyPayments && deletePayment(p.id)}
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Registrar pago (FORM) */}
                    <div className={`rounded-xl p-4 border ${canApplyPayments ? "bg-neutral-900/60 border-neutral-800" : "bg-neutral-950/40 border-neutral-800/60"}`}>
                      {!canApplyPayments && (
                        <div className="rounded-md border border-amber-800/40 bg-amber-900/20 text-amber-100 text-sm px-3 py-2 mb-3">
                          {detectFinanceHandling(o).kind === "CASH"
                            ? "Operación de contado: no corresponde registrar pagos."
                            : "Esta orden será cobrada por el banco/operador. No corresponde registrar pagos aquí."}
                        </div>
                      )}

                      <div className="text-sm text-neutral-300 mb-3">Registrar pago</div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 opacity-100">
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Cuota (sugerir)</label>
                          <select
                            className={selectCls}
                            disabled={!canApplyPayments}
                            value={form.instalmentId || ""}
                            onChange={(e) => onPickInstalment(o, e.target.value)}
                          >
                            <option value="">— Ninguna —</option>
                            {o.instalments.map((ins) => (
                              <option key={ins.id} value={ins.id} disabled={!!ins.isPaid}>
                                #{ins.number} · {new Date(ins.dueDate).toLocaleDateString("es-AR")} · {pesos(ins.amount)}{" "}
                                {ins.isPaid ? "(Paga)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Importe (centavos)</label>
                          <input
                            className={inputCls}
                            disabled={!canApplyPayments}
                            inputMode="numeric"
                            placeholder="ej: 150000 (=$1.500,00)"
                            value={form.amount}
                            onChange={(e) => setForm(o.id, { amount: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Método</label>
                          <select
                            className={selectCls}
                            disabled={!canApplyPayments}
                            value={form.method}
                            onChange={(e) => setForm(o.id, { method: e.target.value })}
                          >
                            <option value="CASH">Efectivo</option>
                            <option value="CARD">Tarjeta</option>
                            <option value="TRANSFER">Transferencia</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Referencia</label>
                          <input
                            className={inputCls}
                            disabled={!canApplyPayments}
                            placeholder="N° operación / nota"
                            value={form.reference}
                            onChange={(e) => setForm(o.id, { reference: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">Fecha</label>
                          <input
                            type="date"
                            className={inputCls}
                            disabled={!canApplyPayments}
                            value={form.date}
                            onChange={(e) => setForm(o.id, { date: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          className={btnCls + " disabled:opacity-50"}
                          disabled={submittingOrderId === o.id || !canApplyPayments}
                          onClick={() => submitPayment(o.id, o)}
                          title={canApplyPayments ? "Registrar pago" : "Cobranza por banco/contado: registro deshabilitado"}
                        >
                          {submittingOrderId === o.id ? "Guardando…" : "Registrar pago"}
                        </button>
                        <div className="text-xs text-zinc-400">
                          Tip: elegí una cuota para completar el importe automáticamente.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/* =============== Subcomponente de tarjeta de total =============== */
function Card({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl bg-black/40 p-3 border ${highlight ? "border-amber-400/40 ring-1 ring-amber-400/20" : "border-neutral-800"}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`text-lg mt-0.5 font-semibold tabular-nums ${highlight ? "text-amber-300" : ""}`}>
        {pesos(value)}
      </div>
    </div>
  );
}
