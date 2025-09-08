"use client";

import { useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string };
type OrderLite = { id: string; code: string; date: string; clientName: string; totalFinal: number };
type OrderDetail = {
  id: string;
  code: string;
  clientName: string;
  createdAt: string;
  totalFinal: number;
  items: {
    orderItemId: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    suggestedCostNet: number;
  }[];
};

function peso(n: number) {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n / 100);
  } catch {
    return `$ ${ (n/100).toFixed(2) }`;
  }
}

export default function SupplierInvoicesPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);

  // Form principal
  const [supplierId, setSupplierId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [docType, setDocType] = useState<"A" | "B" | "C">("A");
  const [pos, setPos] = useState("0001");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [vatPct, setVatPct] = useState(21);
  const [saving, setSaving] = useState(false);

  // Ítems a facturar (para type = PRODUCTS). Se inicializan desde la orden elegida.
  type Row = { orderItemId: string; productId: string; description: string; quantity: number; unitCostNet: number };
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    // Carga proveedores
    fetch("/api/suppliers")
      .then(r => r.ok ? r.json() : [])
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
    // Carga órdenes lite (código, fecha, cliente, total)
    fetch("/api/orders/list-lite")
      .then(r => r.ok ? r.json() : [])
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  // Al elegir orden, traigo detalle e inicializo filas con costos sugeridos
  useEffect(() => {
    if (!orderId) {
      setOrderDetail(null);
      setRows([]);
      return;
    }
    (async () => {
      const r = await fetch(`/api/orders/${orderId}`);
      if (!r.ok) { alert("No se pudo cargar la orden"); return; }
      const d: OrderDetail = await r.json();
      setOrderDetail(d);
      setRows(d.items.map(it => ({
        orderItemId: it.orderItemId,
        productId: it.productId,
        description: `${it.productName} (${it.sku})`,
        quantity: it.quantity,
        unitCostNet: it.suggestedCostNet ?? 0,
      })));
    })();
  }, [orderId]);

  // Totales (neto/IVA/bruto) en base a rows
  const totals = useMemo(() => {
    const amountNet = rows.reduce((a, r) => a + (r.quantity * (r.unitCostNet || 0)), 0);
    const amountVat = Math.round(amountNet * (vatPct / 100));
    const amountGross = amountNet + amountVat;
    return { amountNet, amountVat, amountGross };
  }, [rows, vatPct]);

  async function saveInvoice() {
    if (!supplierId) { alert("Elegí un proveedor"); return; }
    if (!orderId) { alert("Elegí una orden"); return; }
    if (!number.trim()) { alert("Ingresá número de factura"); return; }
    if (!rows.length) { alert("No hay ítems para facturar"); return; }

    const payload = {
      supplierId,
      orderId,
      docType,
      pos,
      number,
      date,
      vatPct,
      type: "PRODUCTS",
      items: rows.map(r => ({
        orderItemId: r.orderItemId,
        productId: r.productId,
        quantity: Number(r.quantity || 0),
        unitCostNet: Number(r.unitCostNet || 0),
      })),
    };

    setSaving(true);
    const resp = await fetch("/api/supplier-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!resp.ok) {
      let msg = "No se pudo crear la factura";
      try { const j = await resp.json(); if (j?.error) msg = j.error; } catch {}
      alert(msg);
      return;
    }

    alert("Factura creada");
    // Reset mínimo
    setOrderId("");
    setOrderDetail(null);
    setRows([]);
    setNumber("");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-emerald-400">Facturas de Proveedor (Mercadería)</h1>
          <a href="/admin" className="text-sm text-neutral-400 hover:text-neutral-200">← Volver al Panel</a>
        </header>

        {/* Formulario */}
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Proveedor */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Proveedor</label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
              >
                <option value="">— Elegí —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <a href="/admin/suppliers" className="text-xs text-emerald-400 hover:underline mt-1 inline-block">Gestionar proveedores</a>
            </div>

            {/* Orden */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Orden</label>
              <select
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
              >
                <option value="">— Elegí —</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.code} • {o.clientName} • {peso(o.totalFinal)}
                  </option>
                ))}
              </select>
              <a href="/admin/orders" className="text-xs text-emerald-400 hover:underline mt-1 inline-block">Ir a órdenes</a>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
              />
            </div>
          </div>

          {/* Cabecera factura */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Tipo</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as "A" | "B" | "C")}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Punto de venta</label>
              <input
                value={pos}
                onChange={e => setPos(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
                placeholder="0001"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Número</label>
              <input
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
                placeholder="00001234"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">% IVA</label>
              <input
                type="number"
                value={vatPct}
                onChange={e => setVatPct(parseInt(e.target.value || "0", 10))}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2"
                min={0}
              />
            </div>
          </div>

          {/* Items de la orden (solo PRODUCTS) */}
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <div className="bg-neutral-900/80 px-4 py-2 text-sm text-neutral-300">Ítems de la orden (podés ajustar el costo neto)</div>
            <div className="divide-y divide-neutral-800">
              {orderDetail && rows.length > 0 ? (
                rows.map((r, idx) => (
                  <div key={r.orderItemId} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                    <div className="col-span-5">
                      <div className="text-sm">{r.description}</div>
                      <div className="text-xs text-neutral-400">orderItem: {r.orderItemId}</div>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-neutral-500 mb-1">Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        value={r.quantity}
                        onChange={e => {
                          const v = Math.max(1, parseInt(e.target.value || "1", 10));
                          const next = [...rows]; next[idx] = { ...r, quantity: v }; setRows(next);
                        }}
                        className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-1"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs text-neutral-500 mb-1">Costo neto (centavos)</label>
                      <input
                        type="number"
                        min={0}
                        value={r.unitCostNet}
                        onChange={e => {
                          const v = Math.max(0, parseInt(e.target.value || "0", 10));
                          const next = [...rows]; next[idx] = { ...r, unitCostNet: v }; setRows(next);
                        }}
                        className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-1"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <div className="text-xs text-neutral-500 mb-1">Subtotal neto</div>
                      <div className="font-medium">{peso(r.quantity * (r.unitCostNet || 0))}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-neutral-400">
                  {orderId ? "La orden no tiene ítems" : "Elegí una orden para ver sus ítems"}
                </div>
              )}
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="text-xs text-neutral-400">Neto</div>
              <div className="text-lg font-semibold">{peso(totals.amountNet)}</div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="text-xs text-neutral-400">IVA ({vatPct}%)</div>
              <div className="text-lg font-semibold">{peso(totals.amountVat)}</div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="text-xs text-neutral-400">Total</div>
              <div className="text-lg font-semibold text-emerald-400">{peso(totals.amountGross)}</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <a href="/admin" className="rounded-lg border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
              Cancelar
            </a>
            <button
              onClick={saveInvoice}
              disabled={saving || !supplierId || !orderId || !number}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold px-4 py-2 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar factura"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
