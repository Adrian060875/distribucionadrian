"use client";
import { useState } from "react";

type Order = {
  id: string;
  code: string;
  client: { id: string; fullName: string };
  items: { id: string; quantity: number; unitPrice: number; product: { id: string; sku: string; name: string; costNet: number|null } }[];
};

export default function InvoicesPage() {
  const [searchKey, setSearchKey] = useState(""); // id o cÃ³digo
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  // Campos de factura rÃ¡pida
  const [docType, setDocType] = useState<"PROD"|"SERVICE"|"JV">("PROD");
  const [pos, setPos] = useState("1");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().substring(0,10));
  const [vatPct, setVatPct] = useState("21");
  const [supplierName, setSupplierName] = useState("");
  const [cuit, setCuit] = useState("");

  async function fetchOrder() {
    if (!searchKey.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(searchKey.trim())}`);
      if (!r.ok) { setOrder(null); alert("Orden no encontrada"); return; }
      const j = await r.json();
      setOrder(j);
    } finally {
      setLoading(false);
    }
  }

  // Enviar una factura simple asociada a la orden (guardado en /api/supplier-invoices)
  async function saveInvoice() {
    if (!order) return alert("Primero seleccionÃ¡ una orden");
    if (!supplierName.trim()) return alert("Proveedor / RazÃ³n social requerida");
    if (!number.trim()) return alert("NÃºmero de factura requerido");

    const items = order.items.map(it => ({
      orderItemId: it.id,
      productId: it.product?.id,
      description: `${it.product?.sku ?? ""} ${it.product?.name ?? ""}`.trim(),
      qty: it.quantity,
      unitCostNet: it.product?.costNet ?? 0, // editable en prÃ³ximas iteraciones Ã­tem por Ã­tem
    }));

    const body = {
      kind: docType,           // "PROD" | "SERVICE" | "JV"
      supplierName: supplierName.trim(),
      cuit: cuit.trim() || null,
      orderId: order.id,
      docType: "FA",           // A modo simple (FA/FB/FC); podÃ©s ampliar
      pos: Number(pos) || 1,
      number: number.trim(),
      date,
      vatPct: Number(vatPct) || 0,
      items,
      notes: "",
    };

    const r = await fetch("/api/supplier-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(()=> ({}));
    if (!r.ok) return alert(j?.error || "Error guardando factura");
    alert("Factura guardada");
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-white">Facturas</h2>

      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
        <div className="text-sm text-zinc-300">Buscar orden por <span className="text-emerald-300">ID</span> o <span className="text-emerald-300">CÃ³digo</span></div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input className="min-w-[260px] flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            placeholder="Ej: cmer... o 202508-1234"
            value={searchKey} onChange={e=>setSearchKey(e.target.value)} />
          <button onClick={fetchOrder}
            className="rounded-xl border border-emerald-600/40 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-600/30">
            {loading ? "Buscando..." : "Cargar orden"}
          </button>
        </div>

        {order && (
          <div className="mt-6 space-y-4">
            <div className="text-sm text-zinc-400">
              Orden <span className="text-zinc-200 font-medium">{order.code}</span> â€¢ Cliente: <span className="text-zinc-200">{order.client.fullName}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Cant.</th>
                    <th className="px-3 py-2">Precio venta</th>
                    <th className="px-3 py-2">Costo (neto)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {order.items.map(it => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 text-zinc-300">{it.product?.sku}</td>
                      <td className="px-3 py-2 text-zinc-200">{it.product?.name}</td>
                      <td className="px-3 py-2 text-zinc-200">{it.quantity}</td>
                      <td className="px-3 py-2 text-zinc-200">${(it.unitPrice/100).toLocaleString("es-AR")}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-white"
                          defaultValue={Math.round((it.product?.costNet ?? 0)/100)}
                          onBlur={async (e) => {
                            const value = Math.round(Number(e.target.value) * 100) || 0;
                            // Si mÃ¡s adelante tenÃ©s costNetOverride en OrderItem, mandalo ahÃ­
                            // Por ahora, dejamos el valor para la factura; persistencia fina va en /api/order-items
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Carga de la factura asociada */}
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">Tipo</label>
                  <select value={docType} onChange={e=>setDocType(e.target.value as any)}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
                    <option value="PROD">MercaderÃ­a</option>
                    <option value="SERVICE">Servicio</option>
                    <option value="JV">JV</option>
                  </select>
                </div>
                <input className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  placeholder="Proveedor / RazÃ³n social" value={supplierName} onChange={e=>setSupplierName(e.target.value)} />
                <input className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  placeholder="CUIT (opcional)" value={cuit} onChange={e=>setCuit(e.target.value)} />
                <div className="flex items-center gap-2">
                  <input className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    placeholder="Pto Vta" value={pos} onChange={e=>setPos(e.target.value)} />
                  <input className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    placeholder="NÃºmero" value={number} onChange={e=>setNumber(e.target.value)} />
                </div>
                <input type="date" className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  value={date} onChange={e=>setDate(e.target.value)} />
                <div className="flex items-center gap-2">
                  <label className="text-sm text-zinc-400">IVA %</label>
                  <input type="number" className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                    value={vatPct} onChange={e=>setVatPct(e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <button onClick={saveInvoice}
                  className="rounded-xl border border-emerald-600/40 bg-emerald-600/20 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-600/30">
                  Guardar factura
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
