"use client";
import { useEffect, useState } from "react";

type Row = {
  id:number; createdAt:string;
  client:{ name:string };
  seller?:{ name:string }|null;
  alliance?:{ name:string }|null;
  subtotal:number; interestTotal:number; total:number; advance:number;
  payments:{ amount:number }[];
};

export default function OrdersList(){
  const [from,setFrom]=useState(""); const [to,setTo]=useState("");
  const [rows,setRows]=useState<Row[]>([]);

  async function load(){
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to)   qs.set("to", to);
    const r = await fetch("/api/orders?"+qs.toString(), { cache:"no-store" });
    setRows(await r.json());
  }
  useEffect(()=>{ load(); },[]);

  return (
    <div className="grid gap-4 p-6">
      <h1 className="text-2xl font-semibold">Órdenes</h1>

      <div className="flex gap-2">
        <input type="date" className="border rounded px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
        <input type="date" className="border rounded px-3 py-2" value={to}   onChange={e=>setTo(e.target.value)} />
        <button className="border rounded px-3 py-2" onClick={load}>Buscar</button>
      </div>

      <div className="rounded-2xl border bg-white p-4 overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b">
            <th className="p-2">#</th><th className="p-2">Fecha</th><th className="p-2">Cliente</th>
            <th className="p-2">Vendedor</th><th className="p-2">Alianza</th>
            <th className="p-2">Subtotal</th><th className="p-2">Interés</th><th className="p-2">Total</th>
            <th className="p-2">Pagado</th><th className="p-2">Saldo</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(o=>{
              const pagado = o.payments.reduce((a,p)=>a+p.amount,0);
              const saldo = o.total - pagado - o.advance;
              return (
                <tr key={o.id} className="border-b">
                  <td className="p-2">{o.id}</td>
                  <td className="p-2">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="p-2">{o.client?.name}</td>
                  <td className="p-2">{o.seller?.name ?? "-"}</td>
                  <td className="p-2">{o.alliance?.name ?? "-"}</td>
                  <td className="p-2">${o.subtotal.toLocaleString()}</td>
                  <td className="p-2">${o.interestTotal.toLocaleString()}</td>
                  <td className="p-2">${o.total.toLocaleString()}</td>
                  <td className="p-2">${pagado.toLocaleString()}</td>
                  <td className="p-2">${saldo.toLocaleString()}</td>
                  <td className="p-2"><a className="underline" href={`/orders/${o.id}`}>Editar</a></td>
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={11} className="p-4 text-slate-500">Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
