"use client";
import { useEffect, useMemo, useState } from "react";

type Plan = {
  id: string;
  name: string;
  months: number;
  interestPct: number;
  isActive: boolean;
  createdAt?: string;
};

export default function PlansPage() {
  const [list, setList] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Alta
  const [form, setForm] = useState({ name: "", months: "12", interestPct: "0", isActive: true });
  const [savingNew, setSavingNew] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", months: "0", interestPct: "0", isActive: true });
  const money = useMemo(() => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 }), []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/financing-plans", { cache: "no-store" });
      const j = r.ok ? await r.json() : [];
      setList(Array.isArray(j) ? j : (j?.data ?? []));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingNew(true);
    const body = {
      name: form.name.trim(),
      months: Number(form.months || "0"),
      interestPct: Number(form.interestPct || "0"),
      isActive: !!form.isActive,
    };
    const r = await fetch("/api/financing-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingNew(false);
    if (!r.ok) { alert("No se pudo crear el plan"); return; }
    setForm({ name: "", months: "12", interestPct: "0", isActive: true });
    load();
  }

  function startEdit(p: Plan) {
    setEditingId(p.id);
    setEdit({
      name: p.name,
      months: String(p.months ?? 0),
      interestPct: String(p.interestPct ?? 0),
      isActive: !!p.isActive,
    });
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(id: string) {
    const body = {
      name: edit.name.trim(),
      months: Number(edit.months || "0"),
      interestPct: Number(edit.interestPct || "0"),
      isActive: !!edit.isActive,
    };
    const r = await fetch(`/api/financing-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) { alert("No se pudo guardar"); return; }
    setEditingId(null);
    load();
  }
  async function del(id: string) {
    if (!confirm("¿Borrar plan de financiación? Si está usado por órdenes, puede fallar.")) return;
    const r = await fetch(`/api/financing-plans/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      alert(t || "No se pudo borrar (¿está referenciado por alguna orden?)");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <a href="/admin" className="rounded-lg border border-emerald-700/40 px-3 py-1.5 text-emerald-300 hover:bg-emerald-700/10">← Volver</a>
        <h1 className="text-2xl font-semibold">Planes de Financiación</h1>
      </div>

      {/* Alta */}
      <form onSubmit={createPlan} className="grid md:grid-cols-6 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
        <input placeholder="Nombre *" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
        <div>
          <div className="text-xs text-zinc-400">Meses</div>
          <input type="number" value={form.months} onChange={e=>setForm({...form, months:e.target.value})} />
        </div>
        <div>
          <div className="text-xs text-zinc-400">% Interés</div>
          <input type="number" step="0.01" value={form.interestPct} onChange={e=>setForm({...form, interestPct:e.target.value})} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form, isActive:e.target.checked})}/>
          <span>Activo</span>
        </label>
        <div className="md:col-span-2 text-right">
          <button disabled={savingNew} className="btn-emerald">{savingNew ? "Guardando…" : "Agregar plan"}</button>
        </div>
      </form>

      {/* Lista */}
      <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-400">
            <tr>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-right">Meses</th>
              <th className="p-2 text-right">% Interés</th>
              <th className="p-2 text-center">Activo</th>
              <th className="p-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(p=>(
              <tr key={p.id} className="border-t border-zinc-800/60">
                <td className="p-2">
                  {editingId===p.id ? (
                    <input value={edit.name} onChange={e=>setEdit({...edit, name:e.target.value})}/>
                  ) : p.name}
                </td>
                <td className="p-2 text-right">
                  {editingId===p.id ? (
                    <input className="text-right" type="number" value={edit.months} onChange={e=>setEdit({...edit, months:e.target.value})}/>
                  ) : p.months}
                </td>
                <td className="p-2 text-right">
                  {editingId===p.id ? (
                    <input className="text-right" type="number" step="0.01" value={edit.interestPct} onChange={e=>setEdit({...edit, interestPct:e.target.value})}/>
                  ) : `${money.format(p.interestPct)}%`}
                </td>
                <td className="p-2 text-center">
                  {editingId===p.id ? (
                    <input type="checkbox" checked={edit.isActive} onChange={e=>setEdit({...edit, isActive:e.target.checked})}/>
                  ) : (p.isActive ? "Sí" : "No")}
                </td>
                <td className="p-2 text-right space-x-2">
                  {editingId===p.id ? (
                    <>
                      <button onClick={()=>saveEdit(p.id)} className="rounded-lg border border-emerald-700/40 px-3 py-1 text-emerald-300 hover:bg-emerald-700/10">Guardar</button>
                      <button onClick={cancelEdit} className="rounded-lg border border-zinc-600/40 px-3 py-1 text-zinc-300 hover:bg-zinc-700/10">Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button onClick={()=>startEdit(p)} className="rounded-lg border border-sky-700/40 px-3 py-1 text-sky-300 hover:bg-sky-700/10">Editar</button>
                      <button onClick={()=>del(p.id)} className="rounded-lg border border-red-600/40 px-3 py-1 text-red-300 hover:bg-red-700/10">Borrar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {list.length===0 && <tr><td className="p-4 text-center text-zinc-400" colSpan={5}>Sin planes</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
