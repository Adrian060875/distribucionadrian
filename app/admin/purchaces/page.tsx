"use client";
import { useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string };
type Invoice = {
  id: string;
  supplierId?: string | null;
  supplierName?: string | null;
  cuit?: string | null;
  docType: string;
  pos?: number | null;
  number?: number | null;
  date: string;
  amountNet: number;
  vatPct: number;
  amountVat: number;
  amountGross: number;
  isPaid: boolean;
  paidAt?: string | null;
  notes?: string | null;
  supplier?: Supplier | null;
};

export default function PurchasesPage() {
  const money = useMemo(
    () => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }),
    []
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // form
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [cuit, setCuit] = useState("");
  const [docType, setDocType] = useState("A");
  const [pos, setPos] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [amountNet, setAmountNet] = useState(""); // en CENTAVOS (como venÃ­as usando)
  const [vatPct, setVatPct] = useState("21");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function d(s: string) {
    return s.replace(/[^\d]/g, "");
  }

  async function load() {
    try {
      const rs = await fetch("/api/suppliers");
      if (rs.ok) {
        const s = await rs.json();
        setSuppliers(Array.isArray(s) ? s : s?.data ?? []);
      }
    } catch {}
    await loadList();
  }

  async function loadList() {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    try {
      const r = await fetch(`/api/supplier-invoices?${q.toString()}`, { cache: "no-store" });
      if (!r.ok) {
        setRows([]);
        return;
      }
      const j = await r.json();
      const list: Invoice[] = Array.isArray(j) ? j : j?.data ?? [];
      setRows(list);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const body: any = {
      supplierId: supplierId || null,
      supplierName: supplierId ? null : supplierName || null,
      cuit: supplierId ? null : cuit || null,
      docType,
      pos: pos ? Number(pos) : null,
      number: number ? Number(number) : null,
      date,
      amountNet: Number(amountNet || "0"), // CENTAVOS
      vatPct: Number(vatPct || "21"),
      notes: notes || null,
    };
    if (!body.amountNet) {
      alert("Importe neto requerido");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/supplier-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(t || "No se pudo crear");
      return;
    }
    // limpiar form
    setSupplierId("");
    setSupplierName("");
    setCuit("");
    setDocType("A");
    setPos("");
    setNumber("");
    setDate(new Date().toISOString().substring(0, 10));
    setAmountNet("");
    setVatPct("21");
    setNotes("");
    loadList();
  }

  async function togglePaid(row: Invoice) {
    const r = await fetch(`/api/supplier-invoices/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPaid: !row.isPaid,
        paidAt: !row.isPaid ? new Date().toISOString().substring(0, 10) : null,
      }),
    });
    if (r.ok) loadList();
  }

  async function del(id: string) {
    if (!confirm("Â¿Borrar factura?")) return;
    const r = await fetch(`/api/supplier-invoices/${id}`, { method: "DELETE" });
    if (r.ok) loadList();
  }

  return (
    <div className="p-6 grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Compras (MercaderÃ­a) â€” Facturas de Proveedor</h1>
        <a className="btn btn-ghost" href="/admin">
          â† Volver
        </a>
      </div>

      {/* === Alta === */}
      <div className="card p-4 grid gap-3">
        <form onSubmit={create} className="grid md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <div className="text-xs text-slate-400 mb-1">Proveedor (agenda)</div>
            <select className="input w-full" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">â€” No en agenda â€”</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {!supplierId && (
            <>
              <input
                className="input"
                placeholder="Proveedor (texto)"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
              <input className="input" placeholder="CUIT" value={cuit} onChange={(e) => setCuit(e.target.value)} />
            </>
          )}

          <div>
            <div className="text-xs text-slate-400 mb-1">Tipo</div>
            <select className="input w-full" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {["A", "B", "C", "M", "NC", "ND"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <input className="input" placeholder="Pto.Vta." value={pos} onChange={(e) => setPos(d(e.target.value))} />
          <input className="input" placeholder="NÃºmero" value={number} onChange={(e) => setNumber(d(e.target.value))} />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input
            className="input text-right"
            placeholder="Neto (centavos)"
            value={amountNet}
            onChange={(e) => setAmountNet(d(e.target.value))}
          />
          <input
            className="input text-right"
            placeholder="IVA %"
            value={vatPct}
            onChange={(e) => setVatPct(d(e.target.value))}
          />
          <input className="input md:col-span-2" placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="md:col-span-5 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardandoâ€¦" : "Agregar factura"}
            </button>
          </div>
        </form>
      </div>

      {/* === Filtros y listado === */}
      <div className="card p-4 grid gap-3">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-slate-400 mb-1">Desde</div>
            <input className="input w-full" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Hasta</div>
            <input className="input w-full" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Proveedor</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Pto/Nro</th>
                <th className="p-2 text-right">Neto</th>
                <th className="p-2 text-right">IVA</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-center">Pagada</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.date?.substring(0, 10)}</td>
                  <td className="p-2">{r.supplier?.name || r.supplierName || "â€”"}</td>
                  <td className="p-2">{r.docType}</td>
                  <td className="p-2">
                    {(r.pos || "â€”")}/{r.number || "â€”"}
                  </td>
                  <td className="p-2 text-right">{money.format(r.amountNet / 100)}</td>
                  <td className="p-2 text-right">
                    {money.format(r.amountVat / 100)} ({r.vatPct}%)
                  </td>
                  <td className="p-2 text-right">{money.format(r.amountGross / 100)}</td>
                  <td className="p-2 text-center">
                    <button className="btn btn-ghost" onClick={() => togglePaid(r)}>
                      {r.isPaid ? "SÃ­" : "No"}
                    </button>
                  </td>
                  <td className="p-2 text-right">
                    <button className="btn btn-ghost" onClick={() => del(r.id)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={9}>
                    Sin facturas en el rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
