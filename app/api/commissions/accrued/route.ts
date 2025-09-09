// app/api/commissions/accrued/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/commissions/accrued?from=&to=&status=CONFIRMED
 * Calcula comisiones DEVENGADAS (no necesariamente pagadas) por orden,
 * usando seller.commissionPct y alliance.commissionPct.
 * Base por defecto: order.totalFinal
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status") || undefined;

    const where: any = {};
    if (status) where.status = status;
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
        totalFinal: true,
        client: { select: { id: true, fullName: true } },
        seller: { select: { id: true, name: true, commissionPct: true } },
        alliance: { select: { id: true, name: true, commissionPct: true } },
      },
    });

    const rows = orders.map(o => {
      const base = o.totalFinal || 0; // <-- cambiar aquÃƒÂ­ si querÃƒÂ©s otra base (p.ej. totalList)
      const sellerPct = o.seller?.commissionPct || 0;
      const alliancePct = o.alliance?.commissionPct || 0;

      const sellerAmount = Math.round(base * (sellerPct / 100));
      const allianceAmount = Math.round(base * (alliancePct / 100));
      const total = sellerAmount + allianceAmount;

      return {
        orderId: o.id,
        code: o.code,
        date: o.createdAt,
        clientName: o.client?.fullName || "",
        base,
        sellerName: o.seller?.name || null,
        sellerPct,
        sellerAmount,
        allianceName: o.alliance?.name || null,
        alliancePct,
        allianceAmount,
        total,
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.base += r.base;
        acc.seller += r.sellerAmount;
        acc.alliance += r.allianceAmount;
        acc.total += r.total;
        return acc;
      },
      { base: 0, seller: 0, alliance: 0, total: 0 }
    );

    return NextResponse.json({ rows, totals }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudo calcular comisiones devengadas", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

