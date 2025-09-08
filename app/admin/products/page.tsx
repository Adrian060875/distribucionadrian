"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string; name: string; sku: string; description?: string | null;
  costNet: number; listPrice: number; cashPrice: number;
  isActive: boolean; createdAt: string;
};

export default function ProductsPage() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "", sku: "", description: "", costNet: "", listPrice: "", cashPrice: "", isActive: true
  });

  async function fetchJSON<T=any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache:"no-store", ...init });
    if (!res.ok) throw new Error(await res.text().catch(()=>res.statusText));
    const txt = await res.text(); return txt ? JSON.parse(txt) : ([] as unknown as T);
  }

  async function load() {
    setLoading(true);
    try { setList(await fetchJSON<Product[]>("/api/products")); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ load(); }, []);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name, sku: p.sku, description: p.description || "",
      costNet: String(p.costNet ?? 0), listPrice: String(p.listPrice ?? 0), cashPrice: String(p.cashPrice ?? 0),
      isActive: p.isActive
    });
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  async function save() {
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim() || undefined,
      costNet: Number(form.costNet || "0"),
      listPrice: Number(form.listPrice || "0"),
      cashPrice: Number(form.cashPrice || "0"),
      isActive: !!form.isActive,
    };
    if (!payload.name || !payload.sku) { alert("Nombre y SKU son requeridos"); return; }

    if (editingId) {
      await fetchJSON(`/api/products/${editingId}`, {
        method:"PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload)
      });
    } else {
      await fetchJSON("/api/products", {
        method:"POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload)
      });
    }
    setEditingId(null);
    setForm({ name:"", sku:"", description:"", costNet:"", listPrice:"", cashPrice:"", isActive:true });
    await load();
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar producto?")) return;
    const r = await fetch(`/api/products/${id}`, { method:"DELETE" });
    const t = await r.text();
    if (!r.ok) { alert(t || "No se pudo eliminar"); return; }
    await load();
  }

  async function importXlsx() {
    if (!file) { alert("Seleccioná un archivo XLSX"); return; }
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/products/import", { method:"POST", body: fd });
    const t = await r.text();
    if (!r.ok) { alert(`Error importando: ${t}`); return; }
    setFile(null); await load();
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10 space-y-8">
      <h1 className="text-3xl md:text-4xl font-semibold">Productos</h1>

      {/* Alta / edición */}
      <div className="card p-5 space-y-4">
        <h2 className="text-xl font-semibold">{editingId ? "Editar producto" : "Nuevo producto"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input className="input md:col-span-2" placeholder="Nombre *" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))}/>
          <input className="input" placeholder="SKU *" value={form.sku} onChange={e=>setForm(f=>({...f, sku:e.target.value}))}/>
          <input className="input" placeholder="Costo sin IVA (centavos)" inputMode="numeric" value={form.costNet} onChange={e=>setForm(f=>({...f, costNet:e.target.value}))}/>
          <input className="input" placeholder="Precio venta con IVA (centavos)" inputMode="numeric" value={form.listPrice} onChange={e=>setForm(f=>({...f, listPrice:e.target.value}))}/>
          <input className="input" placeholder="Precio contado (centavos)" inputMode="numeric" value={form.cashPrice} onChange={e=>setForm(f=>({...f, cashPrice:e.target.value}))}/>
          <input className="input md:col-span-3" placeholder="Descripción" value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))}/>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={e=>setForm(f=>({...f, isActive:e.target.checked}))}/>
            Activo
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4">Guardar</button>
          {editingId && <button onClick={()=>{ setEditingId(null); setForm({ name:"", sku:"", description:"", costNet:"", listPrice:"", cashPrice:"", isActive:true }); }} className="rounded-xl border px-3">Cancelar</button>}
        </div>
      </div>

      {/* Importar XLSX */}
      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Importar XLSX</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="file" accept=".xlsx" onChange={e=>setFile(e.target.files?.[0] || null)} className="input"/>
          <button onClick={importXlsx} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4">Importar</button>
          <a className="rounded-xl border px-4 py-2 no-underline" href="/api/products/template" target="_blank">Descargar plantilla</a>
        </div>
        <p className="text-sm text-slate-300">Columnas: <b>name, sku, costNet, listPrice, cashPrice, description</b></p>
      </div>

      {/* Listado */}
      <div className="card p-4">
        {loading ? "Cargando…" : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="py-2 px-2 text-left">Nombre</th>
                  <th className="py-2 px-2 text-left">SKU</th>
                  <th className="py-2 px-2 text-right">Costo s/IVA</th>
                  <th className="py-2 px-2 text-right">Precio c/IVA</th>
                  <th className="py-2 px-2 text-right">Contado</th>
                  <th className="py-2 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map(p=>(
                  <tr key={p.id} className="border-b border-slate-800 last:border-0">
                    <td className="py-2 px-2">{p.name}</td>
                    <td className="py-2 px-2">{p.sku}</td>
                    <td className="py-2 px-2 text-right">${(p.costNet/100).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">${(p.listPrice/100).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">${(p.cashPrice/100).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={()=>startEdit(p)} className="px-2 py-1 rounded-xl border mr-2">Editar</button>
                      <button onClick={()=>del(p.id)} className="px-2 py-1 rounded-xl border">Eliminar</button>
                    </td>
                  </tr>
                ))}
                {list.length===0 && <tr><td className="py-4 px-2 text-slate-300" colSpan={6}>Sin productos</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
