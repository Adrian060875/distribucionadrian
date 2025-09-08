"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Mini = { id: string; name: string };
type Client = { id: string; fullName: string };
type Product = { id: string; name: string; sku?: string; listPrice: number; cashPrice: number };
type Plan = { id: string; name: string; months: number; interestPct: number };

type Item = {
  key: string;
  productId: string;
  productName: string;
  qty: string;            // UI (solo dígitos)
  unitPricePesos: string; // UI en pesos (sin centavos)
};

function onlyDigits(s: string) { return s.replace(/[^\d]/g, ""); }
function moneyFmt(v: number) { return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS"}).format(v/100); }

// Mapeo de modos -> prefijo en name del plan
const MODES = [
  { key: "EFECTIVO", label: "Efectivo", prefix: "EFECTIVO" },
  { key: "PROPIA", label: "Financiado propio", prefix: "PROPIA" },
  { key: "TARJETA", label: "Tarjeta", prefix: "TARJETA" },
  { key: "ROYAL", label: "Financiado empresa", prefix: "ROYAL" },
] as const;
type ModeKey = typeof MODES[number]["key"];

export default function NewOrderPage() {
  // Catálogos
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Mini[]>([]);
  const [alliances, setAlliances] = useState<Mini[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Formulario
  const [code, setCode] = useState<string>("AUTO");
  const [clientId, setClientId] = useState<string>("");
  const [sellerId, setSellerId] = useState<string>("");
  const [allianceId, setAllianceId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([
    { key: crypto.randomUUID(), productId:"", productName:"", qty:"1", unitPricePesos:"" }
  ]);

  // Financiación
  const [mode, setMode] = useState<ModeKey>("EFECTIVO");
  const [planId, setPlanId] = useState<string>("");

  // Anticipos / descuentos
  const [downPaymentPesos, setDownPaymentPesos] = useState<string>("0");
  const [coinpayPesos, setCoinpayPesos] = useState<string>("0"); // 👈 NUEVO: Coinpay (va directo a proveedor)
  const [discountPesos, setDiscountPesos] = useState<string>("0");

  const [saving, setSaving] = useState(false);

  // === Carga de catálogos ===
  useEffect(() => { (async () => {
    await Promise.all([
      loadClients(), loadSellers(), loadAlliances(), loadProducts(), loadPlans(), loadNextCode()
    ]);
  })(); }, []);

  async function fetchJson(url: string) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    try {
      const j = await r.json();
      return Array.isArray(j) ? j : (j?.data ?? j);
    } catch { return null; }
  }

  async function loadClients() {
    const j = await fetchJson("/api/clients"); if (!j) return;
    setClients(j.map((c: any)=>({ id: c.id, fullName: c.fullName })));
  }
  async function loadSellers() {
    const j = await fetchJson("/api/sellers"); if (!j) return;
    setSellers(j.map((s:any)=>({ id:s.id, name:s.name })));
  }
  async function loadAlliances() {
    const j = await fetchJson("/api/alliances"); if (!j) return;
    setAlliances(j.map((a:any)=>({ id:a.id, name:a.name })));
  }
  async function loadProducts() {
    const j = await fetchJson("/api/products"); if (!j) return;
    setProducts(j.map((p:any)=>({
      id:p.id, name:p.name, sku:p.sku, listPrice:Number(p.listPrice||0), cashPrice:Number(p.cashPrice||0)
    })));
  }
  async function loadPlans() {
    let j = await fetchJson("/api/financing-plans");
    if (!j) j = await fetchJson("/api/plans");
    if (!j) return;
    setPlans(j.map((p:any)=>({
      id:p.id, name:p.name, months:Number(p.months||0), interestPct:Number(p.interestPct||0)
    })));
  }

  async function loadNextCode() {
    try {
      const r = await fetch("/api/orders/next-code", { cache:"no-store" });
      if (r.ok) {
        const t = await r.text();
        const c = (t || "").replace(/["\s]/g,"");
        if (c) { setCode(c); return; }
      }
    } catch {}
    try {
      const j = await fetchJson("/api/orders");
      if (j && Array.isArray(j) && j.length > 0) {
        const last = [...j].sort((a:any,b:any)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const lastCode: string = last?.code || "";
        const m = String(lastCode).match(/^(.*?)(\d+)$/);
        if (m) {
          const prefix = m[1];
          const num = (parseInt(m[2],10) || 0) + 1;
          setCode(prefix + String(num).padStart(m[2].length, "0"));
          return;
        }
        if (lastCode) { setCode(lastCode + "-1"); return; }
      }
    } catch {}
    setCode("AUTO");
  }

  // === Items ===
  function addItem() {
    setItems(prev => [...prev, { key: crypto.randomUUID(), productId:"", productName:"", qty:"1", unitPricePesos:"" }]);
  }
  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i.key !== key));
  }
  function onProductChange(key: string, productId: string) {
    const p = products.find(x => x.id === productId);
    setItems(prev => prev.map(i => i.key===key
      ? ({
          ...i,
          productId,
          productName: p?.name || "",
          unitPricePesos: p ? String(Math.round((p.cashPrice || p.listPrice)/100)) : "",
        })
      : i));
  }
  function onQtyChange(key: string, qty: string) {
    setItems(prev => prev.map(i => i.key===key ? ({...i, qty: onlyDigits(qty) || "0"}) : i));
  }
  function onUnitChange(key: string, pesos: string) {
    setItems(prev => prev.map(i => i.key===key ? ({...i, unitPricePesos: onlyDigits(pesos)}) : i));
  }

  // === Planes filtrados por modo ===
  const currentMode = MODES.find(m => m.key === mode)!;
  const filteredPlans = useMemo(() => {
    const pref = currentMode.prefix.toUpperCase();
    return plans.filter(p => (p.name || "").toUpperCase().trim().startsWith(pref));
  }, [plans, currentMode]);

  // Si cambiás de modo, reseteo plan para que elijas de ese modo
  useEffect(() => { setPlanId(""); }, [mode]);

  // === Totales (interés sobre mercadería − (descuentos + anticipos + coinpay)) ===
  const totals = useMemo(() => {
    // Suma de ítems (centavos)
    const itemsCents = items.reduce((acc, it) => {
      const q = parseInt(it.qty || "0", 10) || 0;
      const unitPesos = parseInt(it.unitPricePesos || "0", 10) || 0;
      const unitCents = unitPesos * 100;
      return acc + (q * unitCents);
    }, 0);

    const disc = (parseInt(discountPesos || "0", 10) || 0) * 100;
    const down = (parseInt(downPaymentPesos || "0", 10) || 0) * 100;
    const coin = (parseInt(coinpayPesos || "0", 10) || 0) * 100;

    // ✅ Base a financiar = mercadería − descuento − (anticipo + coinpay)
    const baseFinance = Math.max(itemsCents - disc - down - coin, 0);

    const plan = plans.find(p => p.id === planId);
    const interest = plan ? Math.round(baseFinance * (plan.interestPct || 0) / 100) : 0;

    // ✅ Total final = (anticipo + coinpay) + base + interés ≡ mercadería − descuento + interés
    const final = (down + coin) + baseFinance + interest;

    // ✅ A financiar = base + interés
    const toFinance = baseFinance + interest;

    return {
      itemsCents,
      discount: disc,
      down,
      coin,
      downPlusCoin: down + coin,
      baseFinance,
      interest,
      final,
      toFinance,
      plan,
    };
  }, [items, discountPesos, downPaymentPesos, coinpayPesos, planId, plans]);

  // === Cronograma (vista previa) — sobre "A financiar" ===
  const schedule = useMemo(() => {
    const plan = totals.plan;
    if (!plan || !plan.months || plan.months <= 0) return [];
    const base = totals.toFinance;
    if (!base) return [];
    const m = plan.months;

    const quota = Math.floor(base / m);
    const remainder = base - quota * m;

    const first = new Date();
    first.setHours(0,0,0,0);
    first.setMonth(first.getMonth() + 1);

    return Array.from({ length: m }).map((_, i) => {
      const due = new Date(first);
      due.setMonth(first.getMonth() + i);
      const amt = i === m - 1 ? quota + remainder : quota;
      return { n: i + 1, due, amount: amt };
    });
  }, [totals.toFinance, totals.plan]);

  const canSave = useMemo(() => {
    if (!clientId) return false;
    const hasAnyItem = items.some(i => (parseInt(i.qty||"0",10)>0) && (parseInt(i.unitPricePesos||"0",10)>0) && i.productId);
    return hasAnyItem && totals.final >= 0 && !saving;
  }, [clientId, items, totals.final, saving]);

  // === Guardar ===
  async function saveOrder() {
    if (!canSave) return;

    const payload = {
      code: (code || "AUTO").trim(),
      clientId,
      sellerId: sellerId || null,
      allianceId: allianceId || null,

      // Si hay plan => INSTALMENTS, si no => NONE
      financingType: planId ? "INSTALMENTS" : "NONE",
      financingPlanId: planId || null,

      // Mandamos downPayment = anticipo + coinpay para que el backend ya descuente todo
      downPayment: totals.downPlusCoin,
      // Enviamos coinpay aparte por si luego querés persistirlo
      coinpay: totals.coin,

      discount: totals.discount, // centavos

      items: items
        .filter(i => (parseInt(i.qty||"0",10)>0) && (parseInt(i.unitPricePesos||"0",10)>0) && i.productId)
        .map(i => ({
          productId: i.productId,
          quantity: parseInt(i.qty, 10),
          unitPrice: (parseInt(i.unitPricePesos, 10) || 0) * 100,
        })),
    };

    setSaving(true);
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text().catch(()=> "");
        alert(t || "No se pudo crear la orden");
        setSaving(false);
        return;
      }
      const created = await r.json().catch(()=>null);
      const id = created?.id || created?.data?.id;
      window.location.href = id ? `/admin/orders/${id}` : "/admin/orders";
    } catch {
      alert("Error de red/servidor al crear la orden");
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="rounded-lg border border-emerald-700/40 px-3 py-1.5 text-emerald-300 hover:bg-emerald-700/10">← Volver</Link>
          <h1 className="text-2xl font-semibold">Nueva orden</h1>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-black px-5 py-3 text-white shadow-sm">
          <div className="text-xs text-zinc-400">Total final</div>
          <div className="text-3xl font-bold text-amber-300 leading-tight">{moneyFmt(totals.final)}</div>
        </div>
      </div>

      {/* Línea 1 */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap md:flex-nowrap items-end gap-3">
          <div className="min-w-[160px]">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Nº de orden</label>
              <span className="text-[10px] rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">auto</span>
            </div>
            <input
              value={code}
              onChange={e=>setCode(e.target.value)}
              className="w-full"
              title="Se genera automáticamente; podés ajustar si lo necesitás"
            />
          </div>

          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-zinc-400">Cliente *</label>
            <select className="w-full" value={clientId} onChange={e=>setClientId(e.target.value)}>
              <option value="">Elegí cliente…</option>
              {clients.map(c=> <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-zinc-400">Vendedor</label>
            <select className="w-full" value={sellerId} onChange={e=>setSellerId(e.target.value)}>
              <option value="">(Opcional)…</option>
              {sellers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-zinc-400">Alianza</label>
            <select className="w-full" value={allianceId} onChange={e=>setAllianceId(e.target.value)}>
              <option value="">(Opcional)…</option>
              {alliances.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Línea 2: Items (compacta) */}
      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 overflow-auto">
        <table className="min-w-[980px] text-sm w-full table-fixed">
          <colgroup>
            <col className="w-[320px]" />
            <col className="w-[120px]" />
            <col className="w-[200px]" />
            <col className="w-[200px]" />
            <col className="w-[120px]" />
          </colgroup>
        <thead className="text-zinc-400">
            <tr>
              <th className="text-left p-2">Producto</th>
              <th className="text-right p-2">Cant.</th>
              <th className="text-right p-2">Precio unit. (pesos)</th>
              <th className="text-right p-2">Subtotal</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const q = parseInt(it.qty||"0",10) || 0;
              const unit = (parseInt(it.unitPricePesos||"0",10) || 0) * 100;
              const sub = q * unit;
              return (
                <tr key={it.key} className="border-t border-zinc-800/60">
                  <td className="p-2">
                    <select
                      value={it.productId}
                      onChange={e=>onProductChange(it.key, e.target.value)}
                      className="w-full truncate"
                    >
                      <option value="">Elegí…</option>
                      {products.map(p=>(
                        <option key={p.id} value={p.id}>
                          {p.name}{p.sku ? ` (${p.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input className="text-right w-full"
                      inputMode="numeric"
                      value={it.qty}
                      onChange={e=>onQtyChange(it.key, e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input className="text-right w-full"
                      inputMode="numeric"
                      value={it.unitPricePesos}
                      onChange={e=>onUnitChange(it.key, e.target.value)}
                      placeholder="Pesos"
                    />
                  </td>
                  <td className="p-2 text-right">{moneyFmt(sub)}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={()=>removeItem(it.key)}
                      className="rounded-lg border border-red-600/40 px-3 py-1 text-red-300 hover:bg-red-700/10"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={5} className="p-2">
                <button onClick={addItem} className="rounded-lg border border-sky-700/40 px-3 py-1 text-sky-300 hover:bg-sky-700/10">
                  + Agregar ítem
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Línea 3: Financiamiento + Totales + Cuotas */}
      <div className="grid xl:grid-cols-4 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <div className="xl:col-span-2 grid sm:grid-cols-2 gap-3">
          {/* Anticipo + Coinpay */}
          <div>
            <label className="text-xs text-zinc-400">Anticipo (pesos)</label>
            <input
              inputMode="numeric"
              value={downPaymentPesos}
              onChange={e=>setDownPaymentPesos(onlyDigits(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Coinpay (pesos)</label>
            <input
              inputMode="numeric"
              value={coinpayPesos}
              onChange={e=>setCoinpayPesos(onlyDigits(e.target.value))}
              className="w-full"
              title="Pago directo al proveedor. Actúa como anticipo para el cálculo."
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400">Descuento (pesos)</label>
            <input
              inputMode="numeric"
              value={discountPesos}
              onChange={e=>setDiscountPesos(onlyDigits(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Modo + Alternativa (filtrada) */}
          <div>
            <label className="text-xs text-zinc-400">Modo de pago</label>
            <select className="w-full" value={mode} onChange={(e)=>setMode(e.target.value as ModeKey)}>
              {MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-400">Alternativa (plan)</label>
            <select value={planId} onChange={e=>setPlanId(e.target.value)} className="w-full">
              <option value="">(Sin financiación)</option>
              {filteredPlans.map(p=>(
                <option key={p.id} value={p.id}>
                  {p.name} — {p.months} cuotas — {p.interestPct}% interés
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Totales */}
        <div className="rounded-xl border border-neutral-800 bg-black px-4 py-3 text-white shadow-sm">
          <div className="text-xs text-zinc-400">Resumen</div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Mercadería</span><b className="tabular-nums">{moneyFmt(totals.itemsCents)}</b></div>
            <div className="flex justify-between"><span>Descuento</span><b className="tabular-nums">− {moneyFmt(totals.discount)}</b></div>
            <div className="flex justify-between"><span>Anticipo</span><b className="tabular-nums">− {moneyFmt(totals.down)}</b></div>
            <div className="flex justify-between"><span>Coinpay</span><b className="tabular-nums">− {moneyFmt(totals.coin)}</b></div>
            <div className="flex justify-between"><span>Base a financiar</span><b className="tabular-nums">{moneyFmt(totals.baseFinance)}</b></div>
            {totals.plan && (
              <div className="flex justify-between">
                <span>Interés ({totals.plan.interestPct}%)</span>
                <b className="tabular-nums">{moneyFmt(totals.interest)}</b>
              </div>
            )}
            <div className="flex justify-between text-lg"><span>Total final</span><b className="text-amber-300 tabular-nums">{moneyFmt(totals.final)}</b></div>
            <div className="flex justify-between"><span>A financiar</span><b className="tabular-nums">{moneyFmt(totals.toFinance)}</b></div>
          </div>
        </div>

        {/* Cronograma estimado (si hay plan) */}
        {totals.plan && (
          <div className="xl:col-span-4 rounded-xl border border-neutral-800 bg-black/40 p-3 text-white">
            <div className="text-sm mb-2">
              <b>Cronograma estimado</b>{" "}
              <span className="text-zinc-400">({totals.plan.months} cuotas sobre {moneyFmt(totals.toFinance)} a partir del mes siguiente)</span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-[520px] text-sm w-full">
                <thead className="text-zinc-300">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Vencimiento</th>
                    <th className="text-right p-2">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(row => (
                    <tr key={row.n} className="border-t border-zinc-800/60">
                      <td className="p-2">{row.n}</td>
                      <td className="p-2">{row.due.toLocaleDateString()}</td>
                      <td className="p-2 text-right">{moneyFmt(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-zinc-400 mt-2">
                * Vista previa informativa. El cronograma definitivo se genera al confirmar la orden.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guardar */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/orders" className="rounded-lg border border-zinc-600/40 px-4 py-2 text-zinc-300 hover:bg-zinc-700/10">Cancelar</Link>
        <button
          disabled={!canSave}
          onClick={saveOrder}
          className="btn-emerald px-5 py-2"
          title={!canSave ? "Elegí cliente y agregá al menos un ítem con cantidad y precio" : ""}
        >
          {saving ? "Guardando…" : "Crear orden"}
        </button>
      </div>
    </div>
  );
}
