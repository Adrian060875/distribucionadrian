"use client";
import { useEffect, useState } from "react";

type Alliance = { id:number; name:string };
type Seller   = { id:number; name:string };
type Plan     = { id:number; type:string; installments:number };

export default function EditOrder({ params }: { params:{ id:string }}) {
  const id = Number(params.id);
  const [order,setOrder]=useState<any>(null);
  const [alliances,setAlliances]=useState<Alliance[]>([]);
  const [sellers,setSellers]=useState<Seller[]>([]);
  const [plans,setPlans]=useState<Plan[]>([]);
  const [allianceId,setAllianceId]=useState<number|null>(null);
  const [sellerId,setSellerId]=useState<number|null>(null);
  const [planId,setPlanId]=useState<number|null>(null);
  const [advance,setAdvance]=useState<string>("0");

  async function load(){
    const [o, a, s, p] = await Promise.all([
      fetch("/api/orders?from=1900-01-01&to=2999-12-31").then(r=>r.json()).then(rows=>rows.find((x:any)=>x.id===id)),
      fetch("/api/alliances").then(r=>r.json()),
      fetch("/api/sellers").then(r=>r.json()),
      fetch("/api/plans").then(r=>r.json()),
    ]);
    setOrder(o||null); setAlliances(a); setSellers(s); setPlans(p);
    if(o){ setAllianceId(o.alliance?.id ?? null); setSellerId(o.seller?.id ?? null); setPlanId(o.plan?.id ?? null); setAdvance(String(o.advance ?? 0)); }
  }
  useEffect(()=>{ load(); },[id]);

  async function save(){
    const payload = { id, allianceId, sellerId, planId, advance: parseFloat(advance)||0 };
    const r = await fetch("/api/orders", { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    if(!r.ok){ alert("Error al guardar"); return; }
    alert("Guardado");
    load();
  }

  if(!order) return <div className="p-6">Orden #{id} no encontrada</div>;

  return (
    <div className="grid gap-4 p-6">
      <h1 className="text-2xl font-semibold">Editar orden #{id}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 mb-1">Vendedor</label>
          <select className="border rounded px-3 py-2 w-full" value={sellerId ?? ""} onChange={e=>setSellerId(e.target.value?Number(e.target.value):null)}>
            <option value="">(Sin vendedor)</option>
            {sellers.map((s)=> <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Alianza</label>
          <select className="border rounded px-3 py-2 w-full" value={allianceId ?? ""} onChange={e=>setAllianceId(e.target.value?Number(e.target.value):null)}>
            <option value="">(Sin alianza)</option>
            {alliances.map((a)=> <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Plan</label>
          <select className="border rounded px-3 py-2 w-full" value={planId ?? ""} onChange={e=>setPlanId(e.target.value?Number(e.target.value):null)}>
            <option value="">(Sin plan)</option>
            {plans.map((p)=> <option key={p.id} value={p.id}>{p.type} {p.installments} cuotas</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Anticipo</label>
          <input className="border rounded px-3 py-2 w-full" value={advance} onChange={e=>setAdvance(e.target.value)} />
        </div>
      </div>

      <div>
        <button className="border rounded px-3 py-2" onClick={save}>Guardar</button>
      </div>
    </div>
  );
}
