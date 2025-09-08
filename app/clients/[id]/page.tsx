"use client";
import { useEffect, useState } from "react";

type Payment = { amount:number };
type Order = { id:number; total:number; advance:number; payments:Payment[] };
type Client = { id:number; name:string };

export default function ClientDetail({ params }: { params: { id: string }}) {
  const clientId = Number(params.id);
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [toPay, setToPay] = useState<Record<number,string>>({}); // monto por orden

  async function load() {
    // si no tenés /api/clients/[id], no pasa nada; al menos traemos las órdenes:
    const rows = await (await fetch(`/api/orders?clientId=${clientId}`, { cache:"no-store" })).json();
    setOrders(rows);
    // nombre opcional:
    const name = rows[0]?.client?.name ?? `Cliente #${clientId}`;
    setClient({ id: clientId, name });
  }

  useEffect(()=>{ load(); }, [clientId]);

  const totals = orders.reduce((acc, o)=>{
    const pagado = o.payments.reduce((a,p)=>a+p.amount,0);
    acc.total  += o.total;
    acc.pagado += pagado + o.advance;
    acc.saldo  += o.total - pagado - o.advance;
    return acc;
  }, { total:0, pagado:0, saldo:0 });

  async function pay(orderId: number){
    const value = parseFloat(toPay[orderId] || "0");
    if (isNaN(value) || value <= 0) return;
    const r = await fetch("/api/payments", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ orderId, amount: value })
    });
    if (!r.ok) { alert("Error al registrar pago"); return; }
    setToPay(prev=>({ ...prev, [orderId]: "" }));
    load();
  }

  return (
    <div className="grid gap-6 p-6">
      <h1 className="text-2xl font-semibold">{client?.name}</h1>

      {/* Totales agrupados */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-600">Total facturado</div>
          <div className="text-xl font-semibold">${totals.total.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-600">Pagado (incluye anticipos)</div>
          <div className="text-xl font-semibold">${totals.pagado.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-600">Saldo total</div>
          <div className="text-xl font-semibold">${totals.saldo.toLocaleString()}</div>
        </div>
      </div>

      {/* Lista de órdenes del cliente + pagar por orden */}
      <div className="rounded-2xl border bg-white p-4 overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b">
            <th className="p-2 text-left">Orden</th>
            <th className="p-2 text-left">Total</th>
            <th className="p-2 text-left">Pagado</th>
            <th className="p-2 text-left">Saldo</th>
            <th className="p-2 text-left">Monto a pagar</th>
            <th className="p-2"></th>
          </tr></thead>
          <tbody>
            {orders.map(o=>{
              const pagado = o.payments.reduce((a,p)=>a+p.amount,0) + o.advance;
              const saldo = o.total - pagado;
              return (
                <tr key={o.id} className="border-b">
                  <td className="p-2">#{o.id}</td>
                  <td className="p-2">${o.total.toLocaleString()}</td>
                  <td className="p-2">${pagado.toLocaleString()}</td>
                  <td className="p-2">${saldo.toLocaleString()}</td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-28"
                      placeholder="0"
                      value={toPay[o.id] ?? ""}
                      onChange={e=>setToPay(prev=>({ ...prev, [o.id]: e.target.value }))}
                    />
                  </td>
                  <td className="p-2">
                    <button className="border rounded px-3 py-1 hover:bg-slate-50" onClick={()=>pay(o.id)}>
                      Pagar
                    </button>
                  </td>
                </tr>
              );
            })}
            {orders.length===0 && <tr><td colSpan={6} className="p-4 text-slate-500">Sin órdenes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
