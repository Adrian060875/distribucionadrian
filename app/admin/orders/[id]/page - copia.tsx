"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/* ================= Tipos ================= */
type Product = { id: string; sku?: string | null; name: string; listPrice: number };
type FinancingPlan = { id: string; name: string; months: number; interestPct: number };
type MiniRef = { id: string; name: string };

type OrderItem = {
  id?: string; // si es nuevo aún no tiene id
  product?: { id: string; name: string } | null; // <- puede venir vacío al inicio
  productId?: string | null; // <- respaldo por si el backend sólo manda el id
  unitPrice: number; // centavos
  quantity: number;
  qDraft?: string; // para el input
  __tmp?: boolean; // marca de ítem nuevo en UI
};
type OrderDetail = {
  id: string;
  code: string;
  createdAt: string | number;
  client: { id: string; fullName: string };
  seller?: MiniRef | null;
  sellerId?: string | null;
  alliance?: MiniRef | null;
  allianceId?: string | null;

  items: OrderItem[];
  discount: number;     // centavos
  downPayment: number;  // centavos
  /** NUEVO: Coinpay (centavos). Opcional para tolerar backend actual */
  coinpay?: number;     // centavos

  totalFinal: number;   // centavos (persistido)
  financingPlan?: FinancingPlan | null;
  financingPlanId?: string | null;
};

function money(cents: number) {
  const v = (cents || 0) / 100;
  return v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function digits(s: string) {
  return (s || "").replace(/[^\d]/g, "");
}
function parsePesosToCents(s: string) {
  // admite "1234", "1234.56"
  const t = (s || "").replace(/[^\d.]/g, "");
  const n = Number(t || 0);
  return Math.round((isFinite(n) ? n : 0) * 100);
}
function centsToInput(cents: number) {
  return ((cents || 0) / 100).toFixed(2);
}

/** Modos de pago -> prefijo de plan en "name" */
const MODES = [
  { key: "EFECTIVO", label: "Efectivo", prefix: "EFECTIVO" },
  { key: "PROPIA",   label: "Financiado propio", prefix: "PROPIA" },
  { key: "TARJETA",  label: "Tarjeta", prefix: "TARJETA" },
  { key: "ROYAL",    label: "Financiado empresa", prefix: "ROYAL" },
] as const;
type ModeKey = typeof MODES[number]["key"];

/* ================ UI Helpers ================ */
function TotalBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 ${highlight ? "ring-1 ring-amber-400/30" : ""}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${highlight ? "text-amber-300" : "text-zinc-100"}`}>
        ${money(value)}
      </div>
    </div>
  );
}

/* ===================== PÁGINA ===================== */
export default function OrderEdit({ params }: { params: { id: string } }) {
  const { id } = params;

  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // catálogos
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<FinancingPlan[]>([]);
  const [sellers, setSellers] = useState<MiniRef[]>([]);
  const [alliances, setAlliances] = useState<MiniRef[]>([]);

  // fila "agregar item"
  const [newProdId, setNewProdId] = useState("");
  const [newQty, setNewQty] = useState("1");

  // NUEVO: modo de pago (para filtrar alternativas)
  const [mode, setMode] = useState<ModeKey>("EFECTIVO");

  /* ===== Carga ===== */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // orden
        const r = await fetch(`/api/orders/${id}`, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (j) {
          j.items = (j.items || []).map((it: OrderItem) => ({
            ...it,
            qDraft: String(it.quantity ?? 1),
            // normalizamos por si el backend trae productId pero no product
            product: it.product ?? (it.productId ? { id: String(it.productId), name: "" } : null),
          }));

          // normalizamos sellerId / allianceId para selects
          j.sellerId = j.sellerId ?? j.seller?.id ?? null;
          j.allianceId = j.allianceId ?? j.alliance?.id ?? null;
        }
        setData(j);

        // productos (para selector)
        try {
          const rp = await fetch("/api/products", { cache: "no-store" });
          if (rp.ok) {
            const pj = await rp.json();
            const list = Array.isArray(pj) ? pj : pj?.data ?? [];
            setProducts(
              list.map((p: any) => ({
                id: String(p.id),
                sku: p.sku ?? null,
                name: String(p.name ?? ""),
                listPrice: Number(p.listPrice ?? 0),
              }))
            );
          }
        } catch {}

        // planes
        try {
          const rf = await fetch("/api/financing-plans", { cache: "no-store" });
          if (rf.ok) {
            const fj = await rf.json();
            setPlans(Array.isArray(fj) ? fj : fj?.data ?? []);
          }
        } catch {}

        // vendedores
        try {
          const rs = await fetch("/api/sellers", { cache: "no-store" });
          if (rs.ok) {
            const sj = await rs.json();
            const list = Array.isArray(sj) ? sj : sj?.data ?? [];
            setSellers(list.map((s: any) => ({ id: String(s.id), name: String(s.name ?? "") })));
          }
        } catch {}

        // alianzas
        try {
          const ra = await fetch("/api/alliances", { cache: "no-store" });
          if (ra.ok) {
            const aj = await ra.json();
            const list = Array.isArray(aj) ? aj : aj?.data ?? [];
            setAlliances(list.map((a: any) => ({ id: String(a.id), name: String(a.name ?? "") })));
          }
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* ===== Filtro de alternativas por modo ===== */
  const filteredPlans = useMemo(() => {
    const pref = (MODES.find(m => m.key === mode)?.prefix || "EFECTIVO").toUpperCase();
    return plans.filter(p => (p.name || "").toUpperCase().trim().startsWith(pref));
  }, [plans, mode]);

  /* ===== Cálculos (preview en UI) ===== */
  const selectedPlan = useMemo(() => {
    if (!data) return null;
    const pid = data.financingPlanId ?? data.financingPlan?.id ?? null;
    return plans.find((p) => p.id === pid) ?? null;
  }, [plans, data]);

  const subtotal = useMemo(
    () => (data?.items || []).reduce((a, it) => a + (it.unitPrice || 0) * (it.quantity || 0), 0),
    [data]
  );

  // Restas: descuento + anticipo + coinpay (coinpay actúa como anticipo directo al proveedor)
  const totalLessDiscount = Math.max(subtotal - (data?.discount || 0), 0);
  const baseFinance = Math.max(totalLessDiscount - ((data?.downPayment || 0) + (data?.coinpay || 0)), 0);

  const interestPreview = selectedPlan ? Math.round(baseFinance * (selectedPlan.interestPct || 0) / 100) : 0;
  const toFinancePreview = baseFinance + interestPreview;
  const totalFinalPreview = (data?.downPayment || 0) + (data?.coinpay || 0) + baseFinance + interestPreview;

  /* ===== Helpers ===== */
  // Id actual del producto para el <select>, tolerante a estados iniciales
  const getSelectedProductId = (it: OrderItem): string => {
    if (it?.product && typeof it.product === "object") return String(it.product.id || "");
    if (it?.productId != null) return String(it.productId);
    return "";
  };

  /* ===== Handlers de Items ===== */
  function onQtyChange(itemId: string | undefined, val: string) {
    if (!data) return;
    setData({
      ...data,
      items: data.items.map((it) => (it.id === itemId || (it.__tmp && !itemId && it.__tmp) ? { ...it, qDraft: val } : it)),
    });
  }
  function onQtyBlur(itemId: string | undefined) {
    if (!data) return;
    setData({
      ...data,
      items: data.items.map((it) => {
        const match = it.id === itemId || (!itemId && it.__tmp);
        if (!match) return it;
        const n = Math.max(1, Math.floor(Number((it.qDraft || "").replace(/[^\d]/g, "")) || 1));
        return { ...it, quantity: n, qDraft: String(n) };
      }),
    });
  }

  function onProductChange(itemId: string | undefined, productId: string) {
    if (!data) return;
    const p = products.find((pp) => String(pp.id) === String(productId));
    if (!p) return;
    setData({
      ...data,
      items: data.items.map((it) => {
        const match = it.id === itemId || (!itemId && it.__tmp);
        if (!match) return it;
        return {
          ...it,
          productId: p.id,
          product: { id: p.id, name: p.name },
          unitPrice: p.listPrice,
        };
      }),
    });
  }

  function removeItem(itemId?: string) {
    if (!data) return;
    setData({ ...data, items: data.items.filter((it) => (it.id ? it.id !== itemId : it.__tmp === false)) });
  }

  function addItem() {
    if (!data) return;
    const p = products.find((pp) => String(pp.id) === String(newProdId));
    const qty = Math.max(1, Number(newQty || "1"));
    if (!p || !qty) {
      alert("Elegí un producto y cantidad válida");
      return;
    }
    const tmp: OrderItem = {
      id: undefined,
      __tmp: true,
      productId: p.id,
      product: { id: p.id, name: p.name },
      unitPrice: p.listPrice,
      quantity: qty,
      qDraft: String(qty),
    };
    setData({ ...data, items: [...data.items, tmp] });
    setNewProdId("");
    setNewQty("1");
  }

  /* ===== Otros campos: descuento / anticipo / coinpay / plan / vendedor / alianza ===== */
  function setDiscountInput(v: string) {
    if (!data) return;
    setData({ ...data, discount: parsePesosToCents(v) });
  }
  function setDownPaymentInput(v: string) {
    if (!data) return;
    setData({ ...data, downPayment: parsePesosToCents(v) });
  }
  function setCoinpayInput(v: string) {
    if (!data) return;
    setData({ ...data, coinpay: parsePesosToCents(v) });
  }
  function setPlanFiltered(idOrEmpty: string) {
    if (!data) return;
    setData({ ...data, financingPlanId: idOrEmpty || null });
  }
  function setSeller(idOrEmpty: string) {
    if (!data) return;
    const sel = sellers.find((s) => s.id === idOrEmpty) || null;
    setData({ ...data, sellerId: idOrEmpty || null, seller: sel });
  }
  function setAlliance(idOrEmpty: string) {
    if (!data) return;
    const ali = alliances.find((a) => a.id === idOrEmpty) || null;
    setData({ ...data, allianceId: idOrEmpty || null, alliance: ali });
  }

  /* ===== Guardar ===== */
  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      // armamos payload de items: existentes con id, nuevos sin id
      const itemsPayload = data.items.map((it) => ({
        id: it.id, // puede ser undefined para nuevos
        productId: it.product?.id ?? it.productId, // <- tolerante
        quantity: it.quantity,
      }));

      const body = {
        // encabezado
        sellerId: data.sellerId ?? data.seller?.id ?? null,
        allianceId: data.allianceId ?? data.alliance?.id ?? null,

        // montos / plan
        items: itemsPayload,
        discount: data.discount, // centavos

        /** Enviamos downPayment = anticipo + coinpay (para que el backend descuente todo) */
        downPayment: (data.downPayment || 0) + (data.coinpay || 0),

        /** Enviamos coinpay aparte (si backend aún no lo guarda, lo ignorará sin romper) */
        coinpay: data.coinpay || 0,

        financingPlanId: data.financingPlanId ?? data.financingPlan?.id ?? null,

        // recalcular cuotas en backend
        regenerateInstalments: true,
      };

      const r = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        alert(t || "No se pudo guardar");
        return;
      }
      const j = await r.json();

      // refrescamos desde backend para limpiar tmp y traer totales/plan regenerados
      setData({
        ...j,
        sellerId: j.sellerId ?? j.seller?.id ?? null,
        allianceId: j.allianceId ?? j.alliance?.id ?? null,
        items: (j.items || []).map((it: any) => ({
          ...it,
          qDraft: String(it.quantity ?? 1),
          product: it.product ?? (it.productId ? { id: String(it.productId), name: "" } : null),
        })),
      });
      alert("Cambios guardados");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-[#0b0f0d] text-zinc-100 p-6">Cargando…</main>;
  if (!data) return <main className="min-h-screen bg-[#0b0f0d] text-zinc-100 p-6">No encontrada</main>;

  return (
    <main className="min-h-screen bg-[#0b0f0d] text-zinc-100 p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-emerald-300">Orden {data.code}</h1>
        <Link href="/admin/orders" className="text-sm text-emerald-300 border border-emerald-600/40 px-3 py-1 rounded-lg hover:bg-emerald-600/10">
          ← Volver
        </Link>
      </div>

      <section className="space-y-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 md:p-6">
        {/* Cabecera editable */}
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-zinc-400 mb-1">Cliente</div>
            <div className="font-medium">{data.client?.fullName || "-"}</div>
          </div>

          <div>
            <div className="text-xs text-zinc-400 mb-1">Vendedor</div>
            <select
              className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1"
              value={data.sellerId ?? data.seller?.id ?? ""}
              onChange={(e) => setSeller(e.target.value)}
            >
              <option value="">— Sin vendedor —</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-zinc-400 mb-1">Alianza</div>
            <select
              className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1"
              value={data.allianceId ?? data.alliance?.id ?? ""}
              onChange={(e) => setAlliance(e.target.value)}
            >
              <option value="">— Sin alianza —</option>
              {alliances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-800/70 text-zinc-300">
              <tr>
                <th className="text-left p-2 w-[40%]">Producto</th>
                <th className="p-2 w-36">Cantidad</th>
                <th className="p-2 w-40">Precio</th>
                <th className="p-2 w-44">Subtotal</th>
                <th className="p-2 w-32 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, idx) => (
                <tr key={(it.id ?? "tmp") + "-" + idx} className="border-t border-zinc-800">
                  <td className="p-2">
                    {/* selector de producto (tolerante a estados iniciales) */}
                    <select
                      className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1"
                      value={getSelectedProductId(it)}
                      onChange={(e) => onProductChange(it.id, e.target.value)}
                    >
                      <option value="">Seleccioná un producto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.sku ? `${p.sku} — ${p.name}` : p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-24 rounded-lg px-3 py-1 bg-white text-zinc-900 text-right"
                      value={it.qDraft ?? String(it.quantity ?? 1)}
                      onChange={(e) => onQtyChange(it.id, e.target.value)}
                      onBlur={() => onQtyBlur(it.id)}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <span className="font-semibold tabular-nums text-base text-emerald-300 bg-emerald-900/20 px-2 py-1 rounded-lg">
                      ${money(it.unitPrice)}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <span className="font-semibold tabular-nums text-base text-emerald-200">
                      ${money((it.unitPrice || 0) * (it.quantity || 0))}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <button
                      className="rounded-lg border border-red-600/40 px-3 py-1 text-red-300 hover:bg-red-700/10"
                      onClick={() => removeItem(it.id)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              {/* Fila para agregar nuevo ítem */}
              <tr className="border-t border-zinc-800 bg-zinc-900/40">
                <td className="p-2">
                  <select
                    className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1"
                    value={newProdId}
                    onChange={(e) => setNewProdId(e.target.value)}
                  >
                    <option value="">— Elegí producto —</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.sku ? `${p.sku} — ${p.name}` : p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    className="w-24 rounded-lg px-3 py-1 bg-white text-zinc-900 text-right"
                    inputMode="numeric"
                    value={newQty}
                    onChange={(e) => setNewQty(digits(e.target.value))}
                  />
                </td>
                <td className="p-2 text-right text-zinc-400">—</td>
                <td className="p-2 text-right text-zinc-400">—</td>
                <td className="p-2 text-right">
                  <button
                    className="rounded-lg border border-emerald-600/40 px-3 py-1 text-emerald-300 hover:bg-emerald-700/10"
                    onClick={addItem}
                  >
                    Agregar ítem
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Descuento / Anticipo / Coinpay / Modo / Alternativa */}
        <div className="grid md:grid-cols-5 gap-3">
          <div className="md:col-span-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Descuento (pesos)</div>
                <input
                  className="w-full rounded-lg bg-white text-zinc-900 px-3 py-1 text-right"
                  defaultValue={centsToInput(data.discount)}
                  onBlur={(e) => setDiscountInput(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-zinc-400 mb-1">Anticipo (pesos)</div>
                <input
                  className="w-full rounded-lg bg-white text-zinc-900 px-3 py-1 text-right"
                  defaultValue={centsToInput(data.downPayment)}
                  onBlur={(e) => setDownPaymentInput(e.target.value)}
                />
              </div>

              {/* NUEVO: Coinpay */}
              <div>
                <div className="text-xs text-zinc-400 mb-1">Coinpay (pesos)</div>
                <input
                  className="w-full rounded-lg bg-white text-zinc-900 px-3 py-1 text-right"
                  defaultValue={centsToInput(data.coinpay || 0)}
                  onBlur={(e) => setCoinpayInput(e.target.value)}
                  title="Pago directo al proveedor; actúa como anticipo para el cálculo"
                />
              </div>

              {/* NUEVO: Modo de pago -> filtra alternativas */}
              <div>
                <div className="text-xs text-zinc-400 mb-1">Modo de pago</div>
                <select
                  className="w-full rounded-lg bg-white text-zinc-900 px-3 py-1"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ModeKey)}
                >
                  {MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>

              {/* Alternativa filtrada */}
              <div className="sm:col-span-2">
                <div className="text-xs text-zinc-400 mb-1">Alternativa (plan)</div>
                <select
                  className="w-full rounded-lg bg-white text-zinc-900 px-3 py-1"
                  value={data.financingPlanId ?? data.financingPlan?.id ?? ""}
                  onChange={(e) => setPlanFiltered(e.target.value)}
                >
                  <option value="">— Sin plan —</option>
                  {filteredPlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.months} cuotas • {p.interestPct}% interés)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Totales (preview) */}
          <TotalBox label="Mercadería" value={subtotal} />
          <TotalBox label="Descuento" value={-(data.discount || 0)} />
          <TotalBox label="Anticipo" value={-(data.downPayment || 0)} />
          <TotalBox label="Coinpay" value={-(data.coinpay || 0)} />
          <TotalBox label="Base a financiar" value={baseFinance} />
          {selectedPlan && <TotalBox label={`Interés (${selectedPlan.interestPct}%)`} value={interestPreview} />}
          <TotalBox label="A financiar" value={toFinancePreview} />
          <TotalBox label="Total final" value={totalFinalPreview} highlight />
        </div>

        {/* Cronograma estimado si hay plan */}
        {selectedPlan && selectedPlan.months > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="text-sm mb-2">
              <b>Cronograma estimado</b>{" "}
              <span className="text-zinc-400">
                ({selectedPlan.months} cuotas sobre ${money(toFinancePreview)})
              </span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-[420px] text-sm w-full">
                <thead className="text-zinc-300">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Vencimiento</th>
                    <th className="text-right p-2">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: selectedPlan.months }).map((_, i) => {
                    const quota = Math.floor(toFinancePreview / selectedPlan.months);
                    const remainder = toFinancePreview - quota * selectedPlan.months;
                    const amount = i === selectedPlan.months - 1 ? quota + remainder : quota;

                    const first = new Date(); first.setHours(0,0,0,0); first.setMonth(first.getMonth() + 1);
                    const due = new Date(first); due.setMonth(first.getMonth() + i);

                    return (
                      <tr key={i} className="border-t border-zinc-800/60">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{due.toLocaleDateString()}</td>
                        <td className="p-2 text-right">${money(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-xs text-zinc-400 mt-2">* Vista previa informativa.</div>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            disabled={saving}
            onClick={save}
            className="rounded-xl border border-emerald-600/50 px-5 py-2.5 text-emerald-300 hover:bg-emerald-600/10 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </section>
    </main>
  );
}
