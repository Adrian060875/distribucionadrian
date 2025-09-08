import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// GET /api/payments/list?orderId=&from=&to=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = {};
    if (orderId) where.orderId = orderId;

    if (from || to) {
      where.date = {};
      if (from) {
        const f = new Date(from);
        if (!isNaN(f.getTime())) where.date.gte = f;
      }
      if (to) {
        const t = new Date(to);
        if (!isNaN(t.getTime())) where.date.lte = new Date(t.getTime() + 24*60*60*1000 - 1);
      }
      if (Object.keys(where.date).length === 0) delete where.date;
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { date: "desc" },
      select: { id: true, amount: true, date: true, method: true, orderId: true },
    });

    return NextResponse.json(payments, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudieron listar pagos", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
