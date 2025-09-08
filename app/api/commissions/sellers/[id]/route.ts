import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

// base de comisión: incluye anticipo, excluye interés
// base = totalList - discountAmount (mínimo 0)
const baseForCommission = (o: { totalList: number; discountAmount?: number | null }) =>
  Math.max((o.totalList || 0) - (o.discountAmount || 0), 0);

const calcDue = (base: number, pct: number) => Math.round(base * (Math.max(0, pct) / 100));

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const seller = await prisma.seller.findUnique({ where: { id: params.id } });
  if (!seller) return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, fullName: true } },
      commissionPays: { where: { sellerId: seller.id }, orderBy: { createdAt: "asc" } },
    },
  });

  const rows = orders.map(o => {
    const base = baseForCommission(o);
    const due = calcDue(base, seller.commissionPct || 0);
    const paid = o.commissionPays.reduce((a, p) => a + p.amount, 0);
    const balance = Math.max(due - paid, 0);
    return {
      orderId: o.id,
      code: o.code,
      date: o.createdAt,
      client: o.client,
      base,                          // ahora incluye anticipo
      pct: seller.commissionPct || 0,
      due,
      paid,
      balance,
      payments: o.commissionPays.map(p => ({
        id: p.id, amount: p.amount, createdAt: p.createdAt, notes: p.notes
      })),
    };
  });

  const totals = rows.reduce((acc, x) => {
    acc.due += x.due; acc.paid += x.paid; acc.balance += x.balance; return acc;
  }, { due: 0, paid: 0, balance: 0 });

  return NextResponse.json({
    seller: { id: seller.id, name: seller.name, commissionPct: seller.commissionPct },
    orders: rows,
    totals
  });
}
