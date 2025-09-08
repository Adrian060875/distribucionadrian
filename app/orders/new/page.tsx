"use client";
import { useEffect, useState } from "react";
type Alliance = { id:number; name:string; pct:number };

export default function NewOrder(){
  // …tus estados existentes (cliente, vendedor, plan, items, advance)…
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [allianceId, setAllianceId] = useState<number | null>(null);

  useEffect(()=>{ fetch("/api/alliances").then(r=>r.json()).then(setAlliances); },[]);

  async function create(){
    const payload = { clientId, sellerId, allianceId, planId, items, advance: parseFloat(advance)||0 };
    const r = await fetch("/api/orders", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    if(!r.ok){ alert("Error al crear"); return; }
    window.location.href = "/orders";
  }

  return (
    <div className="grid gap-4 p-6">
      <h1 className="text-2xl font-semibold">Nueva orden</h1>

      {/* …otros campos… */}

      <div>
        <label className="block text-sm text-slate-600 mb-1">Alianza / Embajador</label>
        <select
          className="border rounded px-3 py-2 w-full"
          value={allianceId ?? ""}
          onChange={e=>setAllianceId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">(Sin alianza)</option>
          {alliances.map(a=>(
            <option key={a.id} value={a.id}>{a.name} — {(a.pct*100).toFixed(1)}%</option>
          ))}
        </select>
      </div>

      <button className="border rounded px-3 py-2" onClick={create}>Crear orden</button>
    </div>
  );
}
