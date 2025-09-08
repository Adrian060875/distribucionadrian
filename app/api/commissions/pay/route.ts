import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

/**
 * POST /api/commissions/pay
 * body: { kind: "SELLER"|"ALLIANCE", orderId: string, entityId: string, amount: number, notes?: string, sourceKind?: "EXTRA"|"INVOICED" }
 *
 * Registra un pago de comisión y lo asocia a la orden + vendedor/alianza.
 * El campo `sourceKind` se guarda en `notes` (prefijo) para tu conciliación de caja (ingresos/egresos extra).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const { kind, orderId, entityId, amount, notes, sourceKind } = body as {
    kind: "SELLER" | "ALLIANCE";
    orderId: string;
    entityId: string; // sellerId o allianceId
    amount: number;
    notes?: string;
    sourceKind?: "EXTRA" | "INVOICED";
  };

  if (!["SELLER", "ALLIANCE"].includes(kind) || !orderId || !entityId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
  }

  // Validar existencia
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) return NextResponse.json({ error: "Orden inexistente" }, { status: 404 });

  if (kind === "SELLER") {
    const seller = await prisma.seller.findUnique({ where: { id: entityId } });
    if (!seller) return NextResponse.json({ error: "Vendedor inexistente" }, { status: 404 });
  } else {
    const alliance = await prisma.alliance.findUnique({ where: { id: entityId } });
    if (!alliance) return NextResponse.json({ error: "Alianza inexistente" }, { status: 404 });
  }

  const pref = sourceKind ? `[SRC:${sourceKind}] ` : "";
  const created = await prisma.commissionPayment.create({
    data: {
      orderId,
      kind,
      sellerId: kind === "SELLER" ? entityId : null,
      allianceId: kind === "ALLIANCE" ? entityId : null,
      amount: Math.round(amount),
      notes: (pref + (notes || "")).trim() || null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
