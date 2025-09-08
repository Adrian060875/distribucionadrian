"use client";
import { useEffect, useMemo, useState } from "react";

type Plan = {
  id: string;
  name: string;
  planType: "IN_HOUSE" | "CARD" | "COMPANY";
  months: number | null;
  interestPct: number;
  interestKind: "NONE" | "SIMPLE" | "COMPOUND";
  cardProvider: string | null;
  cardPlanCode: string | null;
  cardFeePct: number | null;
  companyName: string | null;
  companyNotes: string | null;
  isActive: boolean;
  notes: string | null;
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...(init || {}) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
function parseDec(v: any) {
  if (v == null) return 0;
  const s = String(v).replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function Row({ children }: any) { return <div className="grid gap-3 sm:grid-cols-3">{children}</div>; }
function Field({ label, children }: any) {
  return (
    <label className="text-sm text-zinc-300">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      {children}
    </label>
  );
}
function Input(props: any) {
  return (
    <input {...props}
      className={"w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white " + (props.className || "")}
    />
  );
}
function Select(props: any) {
  return (
    <select {...props}
      className={"w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white " + (props.className || "")}
    />
  );
}

export default function FinancingPage() {
  const [tab, setTab] = useState<"CASH" | "IN_HOUSE" | "CARD" | "COMPANY">("IN_HOUSE");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const empty: Plan = {
    id: "",
    name: "",
    planType: "IN_HOUSE",
    months: 0,
    interestPct: 0,
    interestKind: "NONE",
    cardProvider: "",
    cardPlanCode: "",
    cardFeePct: 0,
    companyName: "",
    companyNotes: "",
    isActive: true,
    notes: "",
  } as any;

  const [form, setForm] = useState<Plan>(empty);
  const isEdit = !!form.id;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await fetchJSON<Plan[]>("/api/financing-plans");
      setPlans(list);
    } catch (e: any) {
      setErr(`Error cargando planes (${e?.message || e})`);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (tab === "CASH") return [];
    return plans.filter((p) => p.planType === tab);
  }, [plans, tab]);

  function newPlan() {
    setForm({ ...empty, planType: tab === "CASH" ? "IN_HOUSE" : tab });
  }
  function editPlan(p: Plan) {
    setForm({
      ...p,
      cardProvider: p.cardProvider || "",
      cardPlanCode: p.cardPlanCode || "",
      companyName: p.companyName || "",
      companyNotes: p.companyNotes || "",
      notes: p.notes || "",
    });
  }
  function cancelForm() { setForm(empty); }

  async function save() {
    try {
      const payload = {
        ...form,
        months: form.months == null ? null : Number(form.months),
        interestPct: parseDec(form.interestPct),
        cardFeePct: form.cardFeePct != null ? parseDec(form.cardFeePct) : null,
        isActive: !!form.isActive,
      };
      if (!isEdit) {
        await fetchJSON("/api/financing-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJSON(`/api/financing-plans/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await load();
      cancelForm();
    } catch (e: any) {
      alert("Error guardando plan: " + (e?.message || e));
    }
  }

  async function removePlan(id: string) {
    if (!confirm("Â¿Eliminar plan?")) return;
    try {
      await fetchJSON(`/api/financing-plans/${id}`, { method: "DELETE" });
      await load();
      if (form.id === id) cancelForm();
    } catch (e: any) {
      alert("Error eliminando plan: " + (e?.message || e));
    }
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Financiamiento</h2>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-1">
          {(["CASH", "IN_HOUSE", "CARD", "COMPANY"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "CASH") setForm(empty); }}
              className={`px-3 py-1 text-xs rounded-lg ${
                tab === t ? "bg-emerald-600/30 text-emerald-200" : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {t === "CASH" ? "Efectivo" : t === "IN_HOUSE" ? "Cuotas propias" : t === "CARD" ? "Tarjeta" : "Financiado empresa"}
            </button>
          ))}
        </div>
      </div>

      {tab === "CASH" ? (
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-sm text-zinc-400">
          El modo efectivo no requiere plan. ConfigurÃ¡ el anticipo al crear la orden.
        </div>
      ) : (
        <>
          {/* listado */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            {loading ? (
              <div className="text-sm text-zinc-400">Cargandoâ€¦</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-zinc-500">No hay planes para este modo.</div>
            ) : (
              <div className="space-y-2">
                {filtered.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
                    <div className="text-sm text-zinc-200">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-zinc-500">
                        Cuotas: {p.months ?? 0} Â· InterÃ©s: {p.interestPct}% ({p.interestKind})
                        {p.planType === "CARD" && <> Â· Fee tarjeta: {p.cardFeePct ?? 0}%</>}
                        {p.planType === "COMPANY" && <> Â· Empresa: {p.companyName || "-"}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{p.isActive ? "Activo" : "Inactivo"}</span>
                      <button onClick={() => editPlan(p)} className="text-xs rounded-lg border border-zinc-700 px-2 py-1 hover:bg-zinc-800">
                        Editar
                      </button>
                      <button onClick={() => removePlan(p.id)} className="text-xs rounded-lg border border-red-700 text-red-300 px-2 py-1 hover:bg-red-900/30">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {err && <div className="mt-2 text-sm text-red-400">{err}</div>}
            <div className="mt-4">
              <button
                onClick={newPlan}
                className="text-xs rounded-lg border border-emerald-700 text-emerald-300 px-3 py-1 hover:bg-emerald-900/30"
              >
                Nuevo plan {tab === "IN_HOUSE" ? "(cuotas propias)" : tab === "CARD" ? "(tarjeta)" : "(empresa)"}
              </button>
            </div>
          </div>

          {/* formulario */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4">
            <div className="text-sm font-semibold text-zinc-300 mb-3">
              {isEdit ? "Editar plan" : "Crear plan"}
            </div>
            <Row>
              <Field label="Nombre">
                <Input value={form.name} onChange={(e:any)=>setForm(f=>({...f, name: e.target.value}))}/>
              </Field>
              <Field label="Modo">
                <Select value={form.planType} onChange={(e:any)=>setForm(f=>({...f, planType: e.target.value}))}>
                  <option value="IN_HOUSE">Cuotas propias</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="COMPANY">Financiado empresa</option>
                </Select>
              </Field>
              <Field label="Activo">
                <Select value={form.isActive ? "1" : "0"} onChange={(e:any)=>setForm(f=>({...f, isActive: e.target.value === "1"}))}>
                  <option value="1">SÃ­</option>
                  <option value="0">No</option>
                </Select>
              </Field>

              <Field label="Cantidad de cuotas">
                <Input
                  type="number"
                  step={1}
                  inputMode="numeric"
                  value={form.months ?? 0}
                  onChange={(e:any)=>setForm(f=>({...f, months: Math.max(0, parseInt(e.target.value || "0", 10))}))}
                />
              </Field>
              <Field label="InterÃ©s % (decimal permitido)">
                <Input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={form.interestPct}
                  onChange={(e:any)=>setForm(f=>({...f, interestPct: parseDec(e.target.value)}))}
                />
              </Field>
              <Field label="Tipo de interÃ©s">
                <Select value={form.interestKind} onChange={(e:any)=>setForm(f=>({...f, interestKind: e.target.value}))}>
                  <option value="NONE">Sin interÃ©s</option>
                  <option value="SIMPLE">Simple</option>
                  <option value="COMPOUND">Compuesto</option>
                </Select>
              </Field>

              {form.planType === "CARD" && (
                <>
                  <Field label="Proveedor de tarjeta">
                    <Input value={form.cardProvider || ""} onChange={(e:any)=>setForm(f=>({...f, cardProvider: e.target.value}))}/>
                  </Field>
                  <Field label="CÃ³digo/Plan tarjeta">
                    <Input value={form.cardPlanCode || ""} onChange={(e:any)=>setForm(f=>({...f, cardPlanCode: e.target.value}))}/>
                  </Field>
                  <Field label="Fee tarjeta % (decimal)">
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={form.cardFeePct ?? 0}
                      onChange={(e:any)=>setForm(f=>({...f, cardFeePct: parseDec(e.target.value)}))}
                    />
                  </Field>
                </>
              )}

              {form.planType === "COMPANY" && (
                <>
                  <Field label="Empresa financiera">
                    <Input value={form.companyName || ""} onChange={(e:any)=>setForm(f=>({...f, companyName: e.target.value}))}/>
                  </Field>
                  <Field label="Notas empresa">
                    <Input value={form.companyNotes || ""} onChange={(e:any)=>setForm(f=>({...f, companyNotes: e.target.value}))}/>
                  </Field>
                </>
              )}

              <Field label="Notas">
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                  value={form.notes || ""}
                  onChange={(e:any)=>setForm(f=>({...f, notes: e.target.value}))}
                />
              </Field>
            </Row>

            <div className="mt-4 flex gap-2">
              <button onClick={save} className="rounded-lg border border-emerald-700 text-emerald-300 px-4 py-2 hover:bg-emerald-900/30">
                {isEdit ? "Guardar cambios" : "Crear plan"}
              </button>
              {isEdit && (
                <button onClick={cancelForm} className="rounded-lg border border-zinc-700 text-zinc-300 px-4 py-2 hover:bg-zinc-800">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
