// app/admin/alliances/[id]/pay-form.tsx
"use client";

import { useState, useTransition } from "react";

export default function PayForm({ allianceId, orderId }: { allianceId: string; orderId?: string }) {
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const payload: any = { amount: Number(amount), notes: notes || undefined };
    if (orderId) payload.orderId = orderId;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/alliances/${allianceId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json?.ok) {
          setMsg(json?.error ?? "Error al registrar pago");
          return;
        }
        setMsg("Pago registrado");
        setAmount("");
        setNotes("");
        window.location.reload();
      } catch (err: any) {
        setMsg(err?.message ?? "Error de red");
      }
    });
  }

  const input = "w-28 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/30";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Monto"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={input}
          required
        />
        <input
          type="text"
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15 disabled:opacity-60"
          title={orderId ? "Registrar pago sobre esta orden" : "Registrar pago libre"}
        >
          {isPending ? "Guardando..." : orderId ? "Pagar orden" : "Pagar (libre)"}
        </button>
      </div>
      {msg && <div className="text-xs text-white/70">{msg}</div>}
    </form>
  );
}
