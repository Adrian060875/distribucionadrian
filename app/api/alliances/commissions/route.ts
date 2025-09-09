import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/alliances/commissions
 * Resumen por alianza:
 *  - commissionDue: suma de comisiones adeudadas por lo cobrado (anticipo + pagos), tope base sin interÃ©s
 *  - breakdown por orden (id, code, cliente, due por esa orden)
 */
export async function GET() {
  try {
    const alliances = await prisma.alliance.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, commissionPct: true },
    });

    if (!alliances.length) return NextResponse.json([]);

    // Traemos las Ã³rdenes por alianza con lo necesario para calcular
    const orders = await prisma.order.findMany({
      where: { allianceId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        allianceId: true,
        totalList: true,
        discount: true,
        downPayment: true,
        client: { select: { fullName: true } },
        payments: { select: { amount: true } },
      },
    });

    const byAlliance: Record<string, {
      allianceId: string;
      allianceName: string;
      commissionPct: number;
      commissionDue: number;
      orders: { id: string; code: string; clientName: string; due: number }[];
    }> = {};

    for (const a of alliances) {
      byAlliance[a.id] = {
        allianceId: a.id,
        allianceName: a.name,
        commissionPct: a.commissionPct || 0,
        commissionDue: 0,
        orders: [],
      };
    }

    for (const o of orders) {
      const aid = o.allianceId as string | null;
      if (!aid || !byAlliance[aid]) continue;

      const pct = byAlliance[aid].commissionPct || 0;

      const baseWithoutInterest = Math.max((o.totalList || 0) - (o.discount || 0), 0);
      const collectedToDate = (o.downPayment || 0) + o.payments.reduce((a, p) => a + (p.amount || 0), 0);
      const commissionable = Math.min(collectedToDate, baseWithoutInterest);
      const due = Math.round(commissionable * (pct / 100));

      byAlliance[aid].commissionDue += due;
      byAlliance[aid].orders.push({
        id: o.id,
        code: o.code,
        clientName: o.client?.fullName ?? "-",
        due,
      });
    }

    const result = Object.values(byAlliance).sort((a, b) =>
      a.allianceName.localeCompare(b.allianceName)
    );

    return NextResponse.json(result);
  } catch (e) {
    console.error("ALLIANCE COMMISSIONS ERROR:", e);
    return NextResponse.json({ error: "No se pudo calcular comisiones" }, { status: 500 });
  }
}

