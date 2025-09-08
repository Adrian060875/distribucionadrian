// app/api/billing/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // desde app/api/billing → @/lib/prisma

function parseDateRange(url: string) {
  const u = new URL(url);
  const from = u.searchParams.get("from") || null; // "YYYY-MM-DD"
  const to   = u.searchParams.get("to")   || null;

  let gte: Date | undefined;
  let lte: Date | undefined;

  if (from) gte = new Date(`${from}T00:00:00.000Z`);
  if (to)   lte = new Date(`${to}T23:59:59.999Z`);
  return { gte, lte };
}

export async function GET(req: Request) {
  const { gte, lte } = parseDateRange(req.url);

  const where: any = {};
  if (gte || lte) where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };

  const orders = await prisma.order.findMany({
    where,
    include: {
      client: true,
      payments: true,                 // cobrado
      supplierInvoices: true,         // compras
      commissionPays: true,           // comisiones pagadas
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = orders.map(o => {
    const collected   = (o.payments ?? []).reduce((a, p) => a + (p.amount ?? 0), 0);
    const purchases   = (o.supplierInvoices ?? []).reduce((a, f) => a + (f.amountGross ?? 0), 0);
    const commissions = (o.commissionPays ?? []).reduce((a, c) => a + (c.amount ?? 0), 0);
    const net         = collected - purchases - commissions;

    return {
      orderId: o.id,
      code: o.code,
      date: o.createdAt,
      client: o.client?.fullName ?? "—",
      collected,
      purchases,
      commissions,
      net,
    };
  });

  const totals = rows.reduce((acc, r) => {
    acc.collected  += r.collected;
    acc.purchases  += r.purchases;
    acc.commissions+= r.commissions;
    acc.net        += r.net;
    return acc;
  }, { collected:0, purchases:0, commissions:0, net:0 });

  return NextResponse.json({ rows, totals });
}

