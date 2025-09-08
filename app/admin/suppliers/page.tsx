"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Supplier = { id: string; name: string };

export default function SuppliersPage() {
  const [list, setList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/suppliers${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" });
      const j = await r.json();
      const data: Supplier[] = Array.isArray(j) ? j : (j?.data ?? []);
      setList(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createSupplier() {
    if (!newName.trim()) { alert("Ingresá un nombre"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (!r.ok) {
        const t = await r.text().catch(()=>"");
        alert(t || "No se pudo crear el proveedor");
        return;
      }
      setNewName("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  function startEdit(s: Supplier) {
    setEditId(s.id);
    setEditName(s.name);
  }
  function cancelEdit() {
    setEditId(null);
    setEditName("");
  }
  async function saveEdit() {
    if (!editId) return;
    if (!editName.trim()) { alert("Ingresá un nombre"); return; }
    const r = await fetch(`/api/suppliers/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() })
    });
    if (!r.ok) {
      const t = await r.text().catch(()=>"");
      alert(t || "No se pudo guardar");
      return;
    }
    setEditId(null);
    setEditName("");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    const r = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const t = await r.text().catch(()=>"");
      // Si el proveedor está en uso, el backend devolverá 409
      alert(t || "No se pudo eliminar. Es posible que el proveedor esté en uso.");
      return;
    }
    await load();
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Proveedores</h1>
          <Link href="/admin" className="text-emerald-400 hover:underline">← Volver</Link>
        </div>

        {/* Buscar + Alta rápida */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
            <div className="text-xs text-neutral-400 mb-1">Buscar</div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg bg-white text-neutral-900 px-3 py-2"
                placeholder="Nombre contiene…"
                value={q}
                onChange={(e)=>setQ(e.target.value)}
              />
              <button
                className="rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-800"
                onClick={load}
              >
                Buscar
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
            <div className="text-xs text-neutral-400 mb-1">Nuevo proveedor</div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg bg-white text-neutral-900 px-3 py-2"
                placeholder="Nombre"
                value={newName}
                onChange={(e)=>setNewName(e.target.value)}
              />
              <button
                className="rounded-lg border border-emerald-600 text-emerald-300 px-3 py-2 hover:bg-emerald-700/10 disabled:opacity-50"
                disabled={creating}
                onClick={createSupplier}
              >
                {creating ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/70 text-neutral-400">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-400">Cargando…</td></tr>
              )}
              {!loading && list.length===0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-neutral-500">No hay proveedores.</td></tr>
              )}
              {list.map(s => (
                <tr key={s.id} className="border-t border-neutral-800/70">
                  <td className="px-4 py-2">
                    {editId === s.id ? (
                      <input
                        className="w-full rounded-lg bg-white text-neutral-900 px-3 py-1.5"
                        value={editName}
                        onChange={(e)=>setEditName(e.target.value)}
                      />
                    ) : (
                      s.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    {editId === s.id ? (
                      <>
                        <button onClick={saveEdit} className="inline-flex rounded-md border border-emerald-600 text-emerald-300 hover:bg-emerald-600/10 px-3 py-1.5">Guardar</button>
                        <button onClick={cancelEdit} className="inline-flex rounded-md border border-neutral-600 text-neutral-300 hover:bg-neutral-700/10 px-3 py-1.5">Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button onClick={()=>startEdit(s)} className="inline-flex rounded-md border border-sky-600 text-sky-300 hover:bg-sky-700/10 px-3 py-1.5">Editar</button>
                        <button onClick={()=>remove(s.id)} className="inline-flex rounded-md border border-red-600 text-red-300 hover:bg-red-700/10 px-3 py-1.5">Eliminar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
