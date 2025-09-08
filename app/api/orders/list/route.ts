// app/api/orders/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// GET /api/orders/list?from=&to=&status=CONFIRMED
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status") || undefined;

    const where: any = {};
    if (status) where.status = status;

    // filtro por fecha de creaciÃ³n si vienen parÃ¡metros
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const f = new Date(from);
        if (!isNaN(f.getTime())) where.createdAt.gte = f;
      }
      if (to) {
        const t = new Date(to);
        if (!isNaN(t.getTime())) where.createdAt.lte = new Date(t.getTime() + 24*60*60*1000 - 1);
      }
      if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        createdAt: true,
        status: true,
        totalFinal: true,
        client: { select: { id: true, fullName: true } },
        payments: { select: { amount: true } },
      },
    });

    const shaped = orders.map(o => {
      const paid = o.payments.reduce((a, p) => a + (p.amount || 0), 0);
      const balance = (o.totalFinal || 0) - paid;
      return {
        id: o.id,
        code: o.code,
        date: o.createdAt,
        status: o.status,
        clientName: o.client?.fullName || "",
        totalFinal: o.totalFinal || 0,
        paid,
        balance,
      };
    });

    return NextResponse.json(shaped, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudieron listar Ã³rdenes", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
