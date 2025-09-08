"use client";

import { useEffect, useState } from "react";

type Client = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdAt: string;
};

export default function ClientsPage() {
  const [list, setList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    birthDate: "",
    notes: "",
  });

  async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
    const txt = await res.text();
    return txt ? JSON.parse(txt) : ([] as unknown as T);
  }

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await fetchJSON<Client[]>("/api/clients");
      setList(r);
    } catch (e: any) {
      setErrorMsg(e.message || "No se pudo cargar clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(c: Client) {
    setEditingId(c.id);
    setForm({
      fullName: c.fullName || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      birthDate: c.birthDate ? String(c.birthDate).substring(0,10) : "",
      notes: c.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : undefined,
      notes: form.notes.trim() || undefined,
    };
    if (!payload.fullName || !payload.phone) { alert("Nombre y teléfono son requeridos"); return; }

    try {
      if (editingId) {
        await fetchJSON(`/api/clients/${editingId}`, {
          method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
        });
      } else {
        await fetchJSON("/api/clients", {
          method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
        });
      }
      setEditingId(null);
      setForm({ fullName:"", phone:"", email:"", address:"", birthDate:"", notes:"" });
      await load();
    } catch (e:any) {
      alert(e.message || "No se pudo guardar");
    }
  }

  async function del(id: string) {
    if (!confirm("¿Eliminar cliente?")) return;
    try {
      const r = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const t = await r.text();
      if (!r.ok) throw new Error(t);
      await load();
    } catch (e:any) {
      alert(e.message || "No se pudo eliminar");
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10 space-y-8">
      <h1 className="text-3xl md:text-4xl font-semibold">Clientes</h1>

      {errorMsg && <div className="card p-3 border-red-400/40 text-red-200">{errorMsg}</div>}

      {/* Form */}
      <div className="card p-5 space-y-4">
        <h2 className="text-xl font-semibold">{editingId ? "Editar cliente" : "Nuevo cliente"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input className="input" placeholder="Nombre completo *" value={form.fullName} onChange={e=>setForm(f=>({...f, fullName: e.target.value}))}/>
          <input className="input" placeholder="Teléfono *" value={form.phone} onChange={e=>setForm(f=>({...f, phone: e.target.value}))}/>
          <input className="input" placeholder="Email" value={form.email} onChange={e=>setForm(f=>({...f, email: e.target.value}))}/>
          <input className="input" placeholder="Dirección" value={form.address} onChange={e=>setForm(f=>({...f, address: e.target.value}))}/>
          <input className="input" type="date" value={form.birthDate} onChange={e=>setForm(f=>({...f, birthDate: e.target.value}))}/>
          <input className="input" placeholder="Notas" value={form.notes} onChange={e=>setForm(f=>({...f, notes: e.target.value}))}/>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2">Guardar</button>
          {editingId && (
            <button onClick={()=>{ setEditingId(null); setForm({ fullName:"", phone:"", email:"", address:"", birthDate:"", notes:"" }); }} className="rounded-xl border px-4 py-2">
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Listado */}
      <div className="card p-4">
        {loading ? "Cargando…" : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="py-2 px-2 text-left">Nombre</th>
                  <th className="py-2 px-2 text-left">Teléfono</th>
                  <th className="py-2 px-2 text-left">Email</th>
                  <th className="py-2 px-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map(c=>(
                  <tr key={c.id} className="border-b border-slate-800 last:border-0">
                    <td className="py-2 px-2">{c.fullName}</td>
                    <td className="py-2 px-2">{c.phone}</td>
                    <td className="py-2 px-2">{c.email || "—"}</td>
                    <td className="py-2 px-2 text-right">
                      <a href={`/admin/clients/${c.id}`} className="px-3 py-1 rounded-xl border mr-2 no-underline">Ver detalle</a>
                      <button onClick={()=>startEdit(c)} className="px-3 py-1 rounded-xl border mr-2">Editar</button>
                      <button onClick={()=>del(c.id)} className="px-3 py-1 rounded-xl border">Eliminar</button>
                    </td>
                  </tr>
                ))}
                {list.length===0 && <tr><td className="py-4 px-2 text-slate-300" colSpan={4}>Sin clientes</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
