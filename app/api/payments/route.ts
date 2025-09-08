import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Aplica un importe sobre las cuotas impagas de la orden, en orden ascendente */
async function applyPaymentToInstalments(params: {
  orderId: string;
  amount: number;   // centavos
  payDate: Date;
}) {
  const { orderId, amount, payDate } = params;
  let remaining = Math.max(0, Math.round(amount));
  if (remaining <= 0) return;

  const instalments = await prisma.instalment.findMany({
    where: { orderId },
    orderBy: { number: "asc" },
  });

  for (const ins of instalments) {
    if (remaining <= 0) break;
    if (ins.isPaid) continue;

    if (remaining >= ins.amount) {
      // cubre toda la cuota → marcar pagada
      await prisma.instalment.update({
        where: { id: ins.id },
        data: { isPaid: true, paidAt: payDate },
      });
      remaining -= ins.amount;
    } else {
      // pago parcial → reducir importe de la cuota actual
      await prisma.instalment.update({
        where: { id: ins.id },
        data: { amount: ins.amount - remaining },
      });
      remaining = 0;
    }
  }
}

/**
 * POST /api/payments
 * body: { orderId: string, amount: number(centavos), method: "CASH"|"CARD"|"TRANSFER", reference?: string, createdAt?: "YYYY-MM-DD" }
 *
 * Cambios clave:
 *  - Sin transacción interactiva larga: primero se crea el pago, luego se imputan las cuotas.
 *  - Evita P2028 por timeout de transacción.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = String(body.orderId || "");
    const amount = Number(body.amount || 0);
    const method = String(body.method || "CASH").toUpperCase();
    const reference = body.reference ? String(body.reference) : null;
    const createdAt = body.createdAt ? new Date(body.createdAt) : new Date();

    if (!orderId) return NextResponse.json({ error: "orderId requerido" }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
    if (!["CASH", "CARD", "TRANSFER"].includes(method)) {
      return NextResponse.json({ error: "Método inválido" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    // 1) Crear el pago (rápido, sin transacción larga)
    const pay = await prisma.payment.create({
      data: {
        orderId,
        amount: Math.round(amount),
        method,
        reference,
        createdAt,
      },
    });

    // 2) Imputar a cuotas (fuera de transacción para evitar timeouts)
    await applyPaymentToInstalments({ orderId, amount: Math.round(amount), payDate: createdAt });

    return NextResponse.json(pay, { status: 201 });
  } catch (e: any) {
    console.error("PAYMENTS_POST_ERROR:", e);
    return NextResponse.json({ error: e?.message || "Error registrando pago" }, { status: 500 });
  }
}
