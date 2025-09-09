// app/api/commissions/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/commissions/list?kind=&orderId=&sellerId=&allianceId=&from=&to=
// kind: "SELLER" | "ALLIANCE" (opcional)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind") || undefined;
    const orderId = searchParams.get("orderId") || undefined;
    const sellerId = searchParams.get("sellerId") || undefined;
    const allianceId = searchParams.get("allianceId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: any = {};
    if (kind) where.kind = kind;
    if (orderId) where.orderId = orderId;
    if (sellerId) where.sellerId = sellerId;
    if (allianceId) where.allianceId = allianceId;

    if (from || to) {
      where.date = {};
      if (from) {
        const f = new Date(from);
        if (!isNaN(f.getTime())) where.date.gte = f;
      }
      if (to) {
        const t = new Date(to);
        if (!isNaN(t.getTime())) where.date.lte = new Date(t.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      if (Object.keys(where.date).length === 0) delete where.date;
    }

    const list = await prisma.commissionPayment.findMany({
      where,
      orderBy: { date: "desc" },
      select: {
        id: true,
        kind: true,          // "SELLER" | "ALLIANCE"
        amount: true,        // centavos
        date: true,
        notes: true,
        order: {
          select: {
            id: true,
            code: true,
            client: { select: { id: true, fullName: true } },
          },
        },
        seller: { select: { id: true, name: true } },
        alliance: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(list, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudieron listar comisiones", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

