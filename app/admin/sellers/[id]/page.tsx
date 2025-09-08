import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// helpers compartidos (idénticos a los del archivo principal)
async function regenerateDefaultSchedule(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { financingPlan: true },
  });
  if (!order) throw new Error("Orden no encontrada");

  if (!order.financingPlanId || !order.financingPlan || order.financingPlan.months <= 0) {
    await prisma.instalment.deleteMany({ where: { orderId } });
    return;
  }

  const count = order.financingPlan.months;
  const amount = Math.floor(order.totalFinal / count);
  const remainder = order.totalFinal - amount * count;
  const start = new Date(order.createdAt);

  await prisma.instalment.deleteMany({ where: { orderId } });

  const data = Array.from({ length: count }).map((_, i) => {
    const due = new Date(start);
    due.setMonth(due.getMonth() + (i + 1));
    return {
      orderId,
      number: i + 1,
      dueDate: due,
      amount: i === count - 1 ? amount + remainder : amount,
      isPaid: false,
      paidAt: null as Date | null,
    };
  });

  await prisma.instalment.createMany({ data });
}

async function applyPaymentToInstalments(orderId: string, amount: number, payDate: Date) {
  let remaining = Math.max(0, Math.round(amount));
  if (remaining === 0) return;

  const instalments = await prisma.instalment.findMany({
    where: { orderId },
    orderBy: { number: "asc" },
  });

  for (const ins of instalments) {
    if (remaining <= 0) break;
    if (ins.isPaid) continue;

    if (remaining >= ins.amount) {
      await prisma.instalment.update({
        where: { id: ins.id },
        data: { isPaid: true, paidAt: payDate },
      });
      remaining -= ins.amount;
    } else {
      await prisma.instalment.update({
        where: { id: ins.id },
        data: { amount: ins.amount - remaining },
      });
      remaining = 0;
    }
  }
}

async function reapplyAllPayments(orderId: string) {
  await regenerateDefaultSchedule(orderId);
  const payments = await prisma.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  for (const p of payments) {
    await applyPaymentToInstalments(orderId, p.amount, p.createdAt);
  }
}

/** PATCH /api/payments/:id — Edita un pago y re-calcula cuotas */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const body = await req.json();

    // Campos editables (según tu schema Payment)
    // amount: Int (centavos)
    // method: "CASH" | "CARD" | "TRANSFER"
    // reference: String|null
    // date: Date (fecha de operación)
    // createdAt: Date (usada para el orden y para paidAt en cuotas)
    const updates: any = {};

    if (typeof body.amount !== "undefined") {
      const n = Number(body.amount);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "amount inválido" }, { status: 400 });
      updates.amount = Math.round(n);
    }

    if (typeof body.method === "string") {
      updates.method = body.method;
    }

    if ("reference" in body) {
      updates.reference = body.reference ? String(body.reference) : null;
    }

    if (typeof body.date !== "undefined") {
      const d = new Date(body.date);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "date inválida" }, { status: 400 });
      updates.date = d;
    }

    if (typeof body.createdAt !== "undefined") {
      const c = new Date(body.createdAt);
      if (isNaN(c.getTime())) return NextResponse.json({ error: "createdAt inválida" }, { status: 400 });
      updates.createdAt = c;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
    }

    // Necesitamos orderId para re-aplicar pagos
    const prev = await prisma.payment.findUnique({
      where: { id },
      select: { orderId: true },
    });
    if (!prev?.orderId) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    await prisma.payment.update({ where: { id }, data: updates });

    await reapplyAllPayments(prev.orderId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error al actualizar pago" }, { status: 500 });
  }
}

/** DELETE /api/payments/:id — Anula un pago y re-calcula cuotas */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    // Traigo el pago para conocer la orden
    const pay = await prisma.payment.findUnique({ where: { id } });
    if (!pay) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    const orderId = pay.orderId;

    // Borro el pago
    await prisma.payment.delete({ where: { id } });

    // Re-aplico todos los pagos restantes a un cronograma limpio
    await reapplyAllPayments(orderId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error al anular pago" }, { status: 500 });
  }
}
