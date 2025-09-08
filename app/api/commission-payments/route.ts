import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/commission-payments
 * Body:
 *  {
 *    type: "SELLER" | "ALLIANCE",
 *    orderId: string,
 *    sellerId?: string,   // requerido si type=SELLER
 *    allianceId?: string, // requerido si type=ALLIANCE
 *    amount: number,      // centavos
 *    notes?: string,
 *    createdAt?: "YYYY-MM-DD"
 *  }
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const type = String(b.type || "").toUpperCase();
    const orderId = String(b.orderId || "");
    const sellerId = b.sellerId ? String(b.sellerId) : undefined;
    const allianceId = b.allianceId ? String(b.allianceId) : undefined;
    const amount = Number(b.amount || 0);
    const notes = b.notes ? String(b.notes) : undefined;
    const createdAt = b.createdAt ? new Date(b.createdAt) : new Date();

    if (!["SELLER", "ALLIANCE"].includes(type)) return NextResponse.json({ error: "type inválido" }, { status: 400 });
    if (!orderId || !amount || amount <= 0) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    if (type === "SELLER" && !sellerId) return NextResponse.json({ error: "sellerId requerido" }, { status: 400 });
    if (type === "ALLIANCE" && !allianceId) return NextResponse.json({ error: "allianceId requerido" }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    const created = await prisma.commissionPayment.create({
      data: {
        type,
        orderId,
        sellerId: type === "SELLER" ? sellerId : undefined,
        allianceId: type === "ALLIANCE" ? allianceId : undefined,
        amount: Math.round(amount),
        notes,
        createdAt,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    console.error("COMMISSION_PAY_CREATE", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
