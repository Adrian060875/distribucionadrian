"use client";
import { useEffect, useMemo, useState } from "react";

type Inv = { id:string; date:string; kind:string; docType:string; pos:number|null; number:string|null; amountGross:number; paidCents:number; status:string; orderId?:string|null };
type Pay = { id:string; date:string; method:string; amountCents:number; notes?:string|null; applications:{invoice:{id:string, number:string|null}}[] };

export default function SupplierDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [sup, setSup] = useState<any>(null);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [edit, setEdit] = useState<{name:string,cuit?:string,phone?:string}>({name:""});

  // pago
  const [method, setMethod] = useState("DEPOSIT"); // CASH | BANK | DEPOSIT | COINPAY | COMPANY_FINANCING
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const currency = useMemo(()=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS"}),[]);

  async function load() {
    const s = await fetch(`/api/suppliers/${id}`).then(r=>r.json());
    const inv = await fetch(`/api/suppliers/${id}/invoices`).then(r=>r.json());
    const pays = await fetch(`/api/suppliers/${id}/payments`).then(r=>r.json());
    setSup(s);
    setEdit({ name: s.name, cuit: s.cuit || "", phone: s.phone || "" });
    setInvoices(inv);
    setPayments(pays);
  }
  useEffect(()=>{ load(); },[id]);

  const balance = sup?.balance ?? invoices.reduce((a,x)=>a+(x.amountGross-x.paidCents),0);

  async function saveHeader() {
    await fetch(`/api/suppliers/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(edit) });
    await load();
  }

  async function createPayment() {
    const amountCents = Math.round(Number((amount||"0").replace(/[^\d.]/g,""))*100);
    if (!amountCents) return alert("Importe inválido");
    const invoiceIds = Object.entries(selected).filter(([,v])=>v).map(([k])=>k);
    const body:any = { supplierId: id, method, amountCents, notes, invoiceIds };
    if (method==="COMPANY_FINANCING") body.ignoreInterest = true;
    const r = await fetch(`/api/supplier-payments`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (!r.ok) return alert(await r.text());
    setAmount(""); setNotes(""); setSelected({});
    await load();
  }

  return (
    <main className="p-6 text-zinc-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Proveedor</h1>
        <a href="/admin/suppliers" className="text-emerald-300">← Volver</a>
      </div>

      {/* encabezado editable */}
      <div className="grid md:grid-cols-4 gap-3 mb-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
        <div>
          <div className="text-xs text-zinc-400">Nombre</div>
          <input className="w-full bg-white text-zinc-900 rounded-lg px-2 py-1" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/>
        </div>
        <div>
          <div className="text-xs text-zinc-400">CUIT (opcional)</div>
          <input className="w-full bg-white text-zinc-900 rounded-lg px-2 py-1" value={edit.cuit||""} onChange={e=>setEdit({...edit,cuit:e.target.value})}/>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Teléfono (opcional)</div>
          <input className="w-full bg-white text-zinc-900 rounded-lg px-2 py-1" value={edit.phone||""} onChange={e=>setEdit({...edit,phone:e.target.value})}/>
        </div>
        <div className="flex items-end justify-between">
          <div>Saldo: <b className="text-amber-300">{currency.format(balance/100)}</b></div>
          <button onClick={saveHeader} className="border border-emerald-600/40 px-3 py-1 rounded-lg text-emerald-300 hover:bg-emerald-600/10">Guardar</button>
        </div>
      </div>

      {/* pago rápido */}
      <div className="grid md:grid-cols-5 gap-3 mb-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
        <div>
          <div className="text-xs text-zinc-400">Método</div>
          <select className="w-full bg-white text-zinc-900 rounded-lg px-2 py-1" value={method} onChange={e=>setMethod(e.target.value)}>
            <option value="DEPOSIT">Depósito</option>
            <option value="BANK">Transferencia</option>
            <option value="CASH">Efectivo</option>
            <option value="COINPAY">Coinpay</option>
            <option value="COMPANY_FINANCING">Financiación empresa</option>
          </select>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Importe (pesos)</div>
          <input className="w-full bg-white text-zinc-900 rounded-lg px-2 py-1 text-right" value={amount} onChange={e=>setAmount(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-zinc-400">Notas</div>
          <input className="w-full bg-white text-zinc-900 rounded-lg px-2 py-1" value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        <div className="flex items-end justify-end">
          <button onClick={createPayment} className="border border-emerald-600/40 px-3 py-1 rounded-lg text-emerald-300 hover:bg-emerald-600/10">Registrar pago</button>
        </div>
      </div>

      {/* facturas del proveedor */}
      <div className="overflow-auto border border-zinc-800 rounded-2xl mb-6">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800/60">
            <tr>
              <th className="p-2"></th>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2">Clase</th>
              <th className="p-2">Doc</th>
              <th className="p-2">Orden</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-right">Pagado</th>
              <th className="p-2 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv=>{
              const total = inv.amountGross/100;
              const pagado = inv.paidCents/100;
              return (
                <tr key={inv.id} className="border-t border-zinc-800">
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={!!selected[inv.id]} onChange={e=>setSelected(s=>({...s,[inv.id]:e.target.checked}))}/>
                  </td>
                  <td className="p-2">{(inv.date||"").substring(0,10)}</td>
                  <td className="p-2">{inv.kind}</td>
                  <td className="p-2">{inv.docType} {inv.pos??""}/{inv.number??""}</td>
                  <td className="p-2">{inv.orderId ? <a className="text-emerald-300" href={`/admin/orders/${inv.orderId}`}>{inv.orderId}</a> : "—"}</td>
                  <td className="p-2 text-right">{currency.format(total)}</td>
                  <td className="p-2 text-right">{currency.format(pagado)}</td>
                  <td className="p-2 text-right">{inv.status}</td>
                </tr>
              );
            })}
            {invoices.length===0 && <tr><td className="p-4 text-center text-zinc-400" colSpan={8}>Sin facturas.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* historial de pagos */}
      <div className="overflow-auto border border-zinc-800 rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800/60">
            <tr>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2">Método</th>
              <th className="p-2 text-right">Importe</th>
              <th className="p-2">Aplicado a</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p=>(
              <tr key={p.id} className="border-t border-zinc-800">
                <td className="p-2">{(p.date||"").substring(0,10)}</td>
                <td className="p-2">{p.method}</td>
                <td className="p-2 text-right">{currency.format(p.amountCents/100)}</td>
                <td className="p-2">{p.applications?.map(a=>a.invoice.number || a.invoice.id).join(", ") || "—"}</td>
              </tr>
            ))}
            {payments.length===0 && <tr><td className="p-4 text-center text-zinc-400" colSpan={4}>Sin pagos.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
