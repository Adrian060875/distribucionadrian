// app/api/alliances/[id]/commissions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeOrderBase, calcCommission } from "../../../../../lib/commissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const alliance = await prisma.alliance.findUnique({
      where: { id },
      select: { id: true, name: true, commissionPct: true },
    });
    if (!alliance) return NextResponse.json({ ok: false, error: "Alliance not found" }, { status: 404 });

    // ÓRDENES FILTRADAS POR ALLIANCE (no por vendedor)
    const orders = await prisma.order.findMany({
      where: { allianceId: id },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    // Comisiones asociadas a esta alianza (admite Commission o CommissionPay)
    const clientAny = prisma as any;
    const hasCommission = typeof clientAny?.commission?.findMany === "function";
    const hasCommissionPay = typeof clientAny?.commissionPay?.findMany === "function";

    let commissions: any[] = [];
    if (hasCommission) {
      commissions = await clientAny.commission.findMany({
        where: { allianceId: id },
        orderBy: { createdAt: "desc" },
      });
    } else if (hasCommissionPay) {
      commissions = await clientAny.commissionPay.findMany({
        where: { allianceId: id },
        orderBy: { createdAt: "desc" },
      });
    }

    const byOrder: Record<string, any[]> = {};
    for (const c of commissions) {
      const key = c.orderId ?? "__NO_ORDER__";
      if (!byOrder[key]) byOrder[key] = [];
      byOrder[key].push(c);
    }

    const rows = orders.map((o: any) => {
      const base = computeOrderBase(o);
      const pct = Number(alliance.commissionPct ?? 0);
      const theoretical = calcCommission(base, pct);

      const norm = (x: any) => String(x?.status ?? (x?.paid ? "PAID" : "PENDING")).toUpperCase();
      const comms = byOrder[o.id] ?? [];
      const paid = comms.filter((c: any) => norm(c) === "PAID").reduce((acc: number, c: any) => acc + Number(c.amount ?? 0), 0);
      const pending = comms.filter((c: any) => norm(c) === "PENDING").reduce((acc: number, c: any) => acc + Number(c.amount ?? 0), 0);

      return {
        orderId: o.id,
        number: o.number,
        base,
        pct,
        theoretical,
        registered: {
          pending,
          paid,
          remaining: Math.max(theoretical - paid, 0),
          entries: comms.map((c: any) => ({
            id: c.id,
            amount: Number(c.amount ?? 0),
            status: norm(c),
            createdAt: c.createdAt,
            paidAt: c.paidAt ?? null,
            notes: c.notes ?? null,
          })),
        },
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.base += r.base;
        acc.theoretical += r.theoretical;
        acc.paid += r.registered.paid;
        acc.pending += r.registered.pending;
        return acc;
      },
      { base: 0, theoretical: 0, paid: 0, pending: 0 }
    );
    const remaining = Math.max(totals.theoretical - totals.paid, 0);

    return NextResponse.json({
      ok: true,
      data: { alliance: { id: alliance.id, name: alliance.name, pct: alliance.commissionPct }, rows, totals: { ...totals, remaining } },
    });
  } catch (error: any) {
    console.error("[GET /api/alliances/:id/commissions] error:", error);
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}
