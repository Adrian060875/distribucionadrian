// app/api/alliances/[id]/pay/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await req.json();
    const orderId: string | undefined = body?.orderId;
    const amount: number = Number(body?.amount ?? 0);
    const notes: string | undefined = body?.notes ?? undefined;

    const alliance = await prisma.alliance.findUnique({ where: { id } });
    if (!alliance) return NextResponse.json({ ok: false, error: "Alliance not found" }, { status: 404 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });

    const clientAny = prisma as any;
    const model = clientAny?.commission ?? clientAny?.commissionPay;
    if (!model) return NextResponse.json({ ok: false, error: "Commission model not found in Prisma schema" }, { status: 500 });

    if (orderId) {
      let remaining = amount;
      const pendings = await model.findMany({
        where: { allianceId: id, orderId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });

      for (const c of pendings) {
        if (remaining <= 0) break;
        await model.update({ where: { id: c.id }, data: { status: "PAID", paidAt: new Date(), notes } });
        remaining -= Number(c.amount ?? 0);
      }

      if (pendings.length === 0) {
        await model.create({
          data: {
            type: "ALLIANCE",
            allianceId: id,
            orderId,
            percentage: Number(alliance.commissionPct ?? 0),
            baseAmount: 0,
            amount,
            status: "PAID",
            paidAt: new Date(),
            notes,
          },
        });
      }

      return NextResponse.json({ ok: true });
    }

    await model.create({
      data: {
        type: "ALLIANCE",
        allianceId: id,
        percentage: Number(alliance.commissionPct ?? 0),
        baseAmount: 0,
        amount,
        status: "PAID",
        paidAt: new Date(),
        notes,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[POST /api/alliances/:id/pay] error:", error);
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}
