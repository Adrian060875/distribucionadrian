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

/* ===================== SECCIÓN: Compras / Proveedores (lista + alta) ===================== */
type PurchaseKind = "PROD" | "SERVICE" | "JV";
type PurchaseItem = {
  id?: string;
  description?: string | null;
  qty: number;
  unitCostNet: number; // EN PESOS NETO (no centavos)
  product?: { id: string; name?: string | null } | null;
  orderItemId?: string | null;
};
type PurchaseInvoice = {
  id: string;
  kind: PurchaseKind;
  supplierId?: string | null;
  supplierName?: string | null;
  amountNet?: number;
  amountGross?: number;
  vatPct?: number | null;
  docType?: string | null;
  pos?: string | null;
  number?: string | null;
  date?: string | null;
  notes?: string | null;
  items?: PurchaseItem[];
};
type PurchasesPayload = {
  invoices: PurchaseInvoice[];
  totals?: {
    totalGross?: number;
    prodGross?: number;
    serviceGross?: number;
    jvGross?: number;
  };
};
type Supplier = { id: string; name: string; cuit?: string | null };

function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/suppliers", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const arr = Array.isArray(j) ? j : j?.data ?? [];
          setSuppliers(arr.map((s: any) => ({ id: String(s.id), name: String(s.name ?? ""), cuit: s.cuit ?? null })));
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);
  return { suppliers, loaded };
}

function SupplierPurchasesSection({ orderId, orderItems }: { orderId: string; orderItems: OrderItem[] }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PurchasesPayload | null>(null);
  const [active, setActive] = useState<PurchaseKind>("PROD");
  const { suppliers } = useSuppliers();

  // Formulario de alta
  const [docType, setDocType] = useState("FA");
  const [pos, setPos] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierCUIT, setSupplierCUIT] = useState("");
  const [serviceVat, setServiceVat] = useState("21"); // sólo SERVICE
  const [serviceAmountNet, setServiceAmountNet] = useState("");
  const [serviceDesc, setServiceDesc] = useState("");
  const [jvAmountNet, setJvAmountNet] = useState("");
  const [jvDesc, setJvDesc] = useState("");

  // Ítems para factura de Productos
  type ProdFormItem = { orderItemId?: string; productName: string; qty: string; unitCostNet: string; enabled: boolean };
  const [prodItems, setProdItems] = useState<ProdFormItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Lista de comprobantes existentes
        const r = await fetch(`/api/orders/${orderId}/purchases`, { cache: "no-store" });
        const j: PurchasesPayload | null = r.ok ? await r.json() : null;

        // Armar base de ítems (Productos) en el form, a partir de los items de la orden
        const base: ProdFormItem[] = (orderItems || []).map((it) => ({
          orderItemId: it.id,
          productName: it.product?.name || "",
          qty: String(Math.max(1, it.quantity || 1)),
          unitCostNet: "", // lo completa el usuario (editable incluso si hoy el costo es 0)
          enabled: true,
        }));

        if (mounted) {
          setData(j);
          setProdItems(base);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [orderId, orderItems]);

  const invoicesByKind = useMemo(() => {
    const g = { PROD: [] as PurchaseInvoice[], SERVICE: [] as PurchaseInvoice[], JV: [] as PurchaseInvoice[] };
    (data?.invoices || []).forEach(inv => {
      const k = (inv.kind || "PROD") as PurchaseKind;
      if (k === "PROD") g.PROD.push(inv);
      else if (k === "SERVICE") g.SERVICE.push(inv);
      else g.JV.push(inv);
    });
    return g;
  }, [data]);

  async function reload() {
    const r = await fetch(`/api/orders/${orderId}/purchases`, { cache: "no-store" });
    const j = r.ok ? await r.json() : null;
    setData(j);
  }

  function resetForm() {
    setDocType("FA"); setPos(""); setNumber(""); setDate(new Date().toISOString().slice(0,10));
    setNotes(""); setSupplierId(""); setSupplierName(""); setSupplierCUIT("");
    setServiceVat("21"); setServiceAmountNet(""); setServiceDesc(""); setJvAmountNet(""); setJvDesc("");
    setProdItems((prev) => prev.map(p => ({ ...p, unitCostNet: "", enabled: true })));
  }

  async function createInvoice() {
    const base: any = {
      kind: active,
      supplierId: supplierId || undefined,
      supplierName: supplierId ? undefined : (supplierName || undefined),
      cuit: supplierId ? undefined : (supplierCUIT || undefined),
      docType: docType || undefined,
      pos: pos || undefined,
      number: number || undefined,
      date: date || undefined,
      notes: notes || undefined,
    };

    let payload: any = base;

    if (active === "PROD") {
      const items = prodItems
        .filter((p) => p.enabled && Number(p.qty) > 0)
        .map((p) => ({
          orderItemId: p.orderItemId,
          // productId: (si lo tuviéramos, pero con orderItemId alcanza para tu endpoint)
          qty: Number(p.qty),
          unitCostNet: Number((p.unitCostNet || "0").replace(",", ".")),
        }));

      if (items.length === 0) {
        alert("Seleccioná al menos un ítem de Productos con costo.");
        return;
      }
      payload = { ...base, items };
    } else if (active === "SERVICE") {
      const amountNet = Number((serviceAmountNet || "0").replace(",", "."));
      if (!amountNet) { alert("Ingresá el monto neto del servicio."); return; }
      payload = { ...base, amountNet, description: serviceDesc || "", vatPct: Number(serviceVat || "0") };
    } else {
      const amountNet = Number((jvAmountNet || "0").replace(",", "."));
      if (!amountNet) { alert("Ingresá el monto neto de JV."); return; }
      payload = { ...base, amountNet, description: jvDesc || "" }; // IVA=0 lo calcula tu endpoint
    }

    const r = await fetch(`/api/orders/${orderId}/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(t || "No se pudo crear la factura del proveedor");
      return;
    }

    await reload();
    resetForm();
    alert("Factura creada correctamente");
  }

  if (loading) {
    return (
      <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm text-zinc-400">Cargando facturación de proveedores…</div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-emerald-300">Facturación de proveedores</h2>
        {data?.totals ? (
          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded border border-zinc-700 px-2 py-1">Total: ${(data.totals.totalGross ?? 0).toLocaleString("es-AR",{maximumFractionDigits:2})}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">Prod: {(data.totals.prodGross ?? 0).toLocaleString("es-AR",{maximumFractionDigits:2})}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">Serv: {(data.totals.serviceGross ?? 0).toLocaleString("es-AR",{maximumFractionDigits:2})}</span>
            <span className="rounded border border-zinc-700 px-2 py-1">JV: {(data.totals.jvGross ?? 0).toLocaleString("es-AR",{maximumFractionDigits:2})}</span>
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["PROD","SERVICE","JV"] as PurchaseKind[]).map(k => (
          <button
            key={k}
            onClick={() => setActive(k)}
            className={`rounded-xl px-3 py-1 text-sm ${active===k ? "bg-emerald-500 text-black" : "border border-zinc-700 hover:bg-zinc-800"}`}
            title={k==="PROD" ? "Productos" : k==="SERVICE" ? "Servicios" : "JV"}
          >
            {k==="PROD" ? "Productos" : k==="SERVICE" ? "Servicios" : "JV"}
          </button>
        ))}
      </div>

      {/* ====== ALTA / FORM ====== */}
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/10 p-3 md:p-4 space-y-3">
        {/* Proveedor */}
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-zinc-400 mb-1">Proveedor (catálogo)</div>
            <select
              className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1"
              value={supplierId}
              onChange={(e)=>{ setSupplierId(e.target.value); if (e.target.value) { setSupplierName(""); setSupplierCUIT(""); } }}
            >
              <option value="">— Elegí proveedor —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.cuit ? ` • ${s.cuit}`:""}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Proveedor (manual)</div>
            <input
              className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1"
              placeholder="Nombre del proveedor"
              value={supplierName}
              onChange={(e)=>{ setSupplierName(e.target.value); if (e.target.value) setSupplierId(""); }}
            />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">CUIT (manual)</div>
            <input
              className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1"
              placeholder="CUIT"
              value={supplierCUIT}
              onChange={(e)=>{ setSupplierCUIT(e.target.value); if (e.target.value) setSupplierId(""); }}
            />
          </div>
        </div>

        {/* Encabezado del comprobante */}
        <div className="grid md:grid-cols-5 gap-3">
          <div>
            <div className="text-xs text-zinc-400 mb-1">Tipo</div>
            <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1" value={docType} onChange={(e)=>setDocType(e.target.value)} placeholder="FA, FB, NC, etc." />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Punto de venta</div>
            <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1" value={pos} onChange={(e)=>setPos(e.target.value)} placeholder="0001" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Número</div>
            <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1" value={number} onChange={(e)=>setNumber(e.target.value)} placeholder="00001234" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Fecha</div>
            <input type="date" className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1" value={date} onChange={(e)=>setDate(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Notas</div>
            <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        {/* Cuerpo según tipo */}
        {active === "PROD" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-zinc-300">
                <tr className="border-b border-zinc-800">
                  <th className="p-2 text-left">Ítem</th>
                  <th className="p-2 text-right w-24">Cant.</th>
                  <th className="p-2 text-right w-40">Costo unit. (neto)</th>
                  <th className="p-2 text-right w-40">Subtotal</th>
                  <th className="p-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {prodItems.map((it, idx) => {
                  const qty = Math.max(0, Number(it.qty || "0"));
                  const cost = Math.max(0, Number(String(it.unitCostNet || "0").replace(",", ".")));
                  const sub = qty * cost;
                  return (
                    <tr key={it.orderItemId || idx} className="border-b border-zinc-800">
                      <td className="p-2">{it.productName || "Ítem vinculado a orden"}</td>
                      <td className="p-2 text-right">
                        <input
                          className="w-24 rounded-lg bg-white text-zinc-900 px-2 py-1 text-right"
                          inputMode="numeric"
                          value={it.qty}
                          onChange={(e)=>setProdItems(old => old.map((o,i)=> i===idx ? {...o, qty: digits(e.target.value)} : o))}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          className="w-36 rounded-lg bg-white text-zinc-900 px-2 py-1 text-right"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={it.unitCostNet}
                          onChange={(e)=>setProdItems(old => old.map((o,i)=> i===idx ? {...o, unitCostNet: e.target.value} : o))}
                        />
                      </td>
                      <td className="p-2 text-right">${sub.toLocaleString("es-AR",{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                      <td className="p-2 text-right">
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            className="scale-110"
                            checked={it.enabled}
                            onChange={(e)=>setProdItems(old => old.map((o,i)=> i===idx ? {...o, enabled: e.target.checked} : o))}
                          />
                          Incluir
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {active === "SERVICE" && (
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Monto neto (pesos)</div>
              <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1 text-right" inputMode="decimal" value={serviceAmountNet} onChange={(e)=>setServiceAmountNet(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <div className="text-xs text-zinc-400 mb-1">IVA (%)</div>
              <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1 text-right" inputMode="numeric" value={serviceVat} onChange={(e)=>setServiceVat(digits(e.target.value))} placeholder="21" />
            </div>
            <div className="md:col-span-3">
              <div className="text-xs text-zinc-400 mb-1">Descripción</div>
              <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1" value={serviceDesc} onChange={(e)=>setServiceDesc(e.target.value)} placeholder="Detalle del servicio" />
            </div>
          </div>
        )}

        {active === "JV" && (
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Monto neto (pesos)</div>
              <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1 text-right" inputMode="decimal" value={jvAmountNet} onChange={(e)=>setJvAmountNet(e.target.value)} placeholder="0.00" />
            </div>
            <div className="md:col-span-3">
              <div className="text-xs text-zinc-400 mb-1">Descripción</div>
              <input className="w-full rounded-lg bg-white text-zinc-900 px-2 py-1" value={jvDesc} onChange={(e)=>setJvDesc(e.target.value)} placeholder="Detalle JV" />
            </div>
          </div>
        )}

        <div className="pt-1">
          <button
            className="rounded-xl border border-emerald-600/50 px-4 py-2 text-emerald-300 hover:bg-emerald-600/10"
            onClick={createInvoice}
            title="Crear factura del proveedor"
          >
            + Crear factura de proveedor
          </button>
        </div>
      </div>

      {/* ====== LISTA DE COMPROBANTES EXISTENTES ====== */}
      <div className="space-y-3">
        {(active==="PROD" ? invoicesByKind.PROD : active==="SERVICE" ? invoicesByKind.SERVICE : invoicesByKind.JV).map(inv => (
          <div key={inv.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{inv.supplierName || "Proveedor s/d"}</span>{" "}
                <span className="text-zinc-400">
                  {inv.docType || "DOC"} {inv.pos ? `${inv.pos}-` : ""}{inv.number || "—"} {inv.date ? `• ${inv.date}` : ""}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-zinc-400 mr-2">Neto: ${(inv.amountNet ?? 0).toLocaleString("es-AR",{maximumFractionDigits:2})}</span>
                <span className="text-emerald-300 font-semibold">Bruto: ${(inv.amountGross ?? inv.amountNet ?? 0).toLocaleString("es-AR",{maximumFractionDigits:2})}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-zinc-300">
                  <tr className="border-b border-zinc-800">
                    <th className="text-left p-2">Ítem</th>
                    <th className="text-right p-2 w-24">Cant.</th>
                    <th className="text-right p-2 w-36">Costo unit. (neto)</th>
                    <th className="text-right p-2 w-40">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.items || []).map((it, idx) => {
                    const st = (Number(it.qty)||0) * (Number(it.unitCostNet)||0);
                    return (
                      <tr key={it.id || idx} className="border-b border-zinc-800">
                        <td className="p-2">
                          {it.description || it.product?.name || "Ítem"}
                          {it.orderItemId ? <span className="ml-2 text-xs text-zinc-500">(vinc. a orden)</span> : null}
                        </td>
                        <td className="p-2 text-right">{it.qty}</td>
                        <td className="p-2 text-right">${(Number(it.unitCostNet)||0).toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                        <td className="p-2 text-right">${(st||0).toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                      </tr>
                    );
                  })}
                  {(inv.items || []).length === 0 ? (
                    <tr>
                      <td className="p-3 text-center text-zinc-500" colSpan={4}>Sin ítems.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {inv.notes ? <div className="px-3 py-2 text-xs text-zinc-400 border-t border-zinc-800">Notas: {inv.notes}</div> : null}
          </div>
        ))}

        {((active==="PROD" && invoicesByKind.PROD.length===0) ||
          (active==="SERVICE" && invoicesByKind.SERVICE.length===0) ||
          (active==="JV" && invoicesByKind.JV.length===0)) && (
          <div className="text-sm text-zinc-400">No hay comprobantes en esta pestaña.</div>
        )}
      </div>
    </section>
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
      const itemsPayload = data.items.map((it) => ({
        id: it.id, // puede ser undefined para nuevos
        productId: it.product?.id ?? it.productId, // <- tolerante
        quantity: it.quantity,
      }));

      const body = {
        sellerId: data.sellerId ?? data.seller?.id ?? null,
        allianceId: data.allianceId ?? data.alliance?.id ?? null,
        items: itemsPayload,
        discount: data.discount, // centavos
        downPayment: (data.downPayment || 0) + (data.coinpay || 0),
        coinpay: data.coinpay || 0,
        financingPlanId: data.financingPlanId ?? data.financingPlan?.id ?? null,
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

      {/* ========== NUEVO: Detalle + ALTA de facturación de proveedores (compras) ========== */}
      <div className="mt-6">
        <SupplierPurchasesSection orderId={id} orderItems={data.items} />
      </div>
    </main>
  );
}
