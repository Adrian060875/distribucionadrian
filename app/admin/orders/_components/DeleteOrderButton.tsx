"use client";
import { useState } from "react";

export default function DeleteOrderButton({ id, onDeleted }: { id: string; onDeleted?: ()=>void }) {
  const [loading, setLoading] = useState(false);

  async function doDelete(force = false) {
    setLoading(true);
    try {
      const url = `/api/orders/${id}` + (force ? `?force=1` : ``);
      const r = await fetch(url, { method: "DELETE" });
      if (r.ok) {
        onDeleted?.();
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!force && r.status === 400) {
        const ok = confirm("La orden tiene pagos. ¿Eliminar de todas formas? Se borrarán pagos, cuotas e ítems.");
        if (ok) return doDelete(true);
      } else {
        alert(data?.error || "No se pudo borrar la orden");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => doDelete(false)}
      disabled={loading}
      className="px-2 py-1 rounded-md text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
      title="Eliminar orden"
    >
      {loading ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
