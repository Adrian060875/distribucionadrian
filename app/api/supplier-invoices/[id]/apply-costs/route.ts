import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id: params.id },
    include: { order: { include: { items: true } }, items: true }
  });
  if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  if (!invoice.orderId) return NextResponse.json({ error: "La factura no está asociada a una orden" }, { status: 400 });

  const orderItems = invoice.order?.items || [];
  const updates: { id: string; costNetOverride: number; vatPct?: number }[] = [];

  for (const it of invoice.items) {
    // buscar target
    let target: any = null;
    if (it.orderItemId) {
      target = orderItems.find(oi => oi.id === it.orderItemId);
    } else if (it.productId) {
      target = orderItems.find(oi => oi.productId === it.productId && !updates.find(u => u.id === oi.id));
    }
    if (!target) continue;

    const unitNet = Math.round((it.costNet || 0) / (it.quantity || 1));
    updates.push({ id: target.id, costNetOverride: unitNet, vatPct: it.vatPct || 21 });
  }

  // aplicar en DB
  await Promise.all(updates.map(u =>
    prisma.orderItem.update({
      where: { id: u.id },
      data: { costNetOverride: u.costNetOverride, costVatPct: u.vatPct ?? 21 }
    })
  ));

  return NextResponse.json({ applied: updates.length });
}
