import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Base comisionable "segÃºn cobrado": anticipo + lo pagado de capital (sin interÃ©s)
function calcCollectedBase(order: any) {
  const paid = order.payments.reduce((a:number,p:any)=>a+p.amount,0);
  const dp = order.downPayment || 0;
  if ((order.totalFinal ?? 0) <= 0) return dp + paid;
  const factor = Math.max(Math.min((order.totalToFinance || 0) / order.totalFinal, 1), 0);
  const adjustedPaid = Math.round(paid * factor);
  const cap = (order.downPayment || 0) + (order.totalToFinance || 0);
  return Math.min(dp + adjustedPaid, cap);
}

// Base comisionable "teÃ³rica": anticipo + principal a financiar (sin interÃ©s), sin depender de cobros
function calcExpectedBase(order: any) {
  return (order.downPayment || 0) + (order.totalToFinance || 0);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId");
  const allianceId = searchParams.get("allianceId");

  if (!sellerId && !allianceId) {
    return NextResponse.json({ error: "sellerId o allianceId requerido" }, { status: 400 });
  }

  const whereOrder:any = {};
  if (sellerId) whereOrder.sellerId = sellerId;
  if (allianceId) whereOrder.allianceId = allianceId;

  const orders = await prisma.order.findMany({
    where: whereOrder,
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      payments: true,
      commissionPays: true,
    },
  });

  let pct = 0;
  if (sellerId) {
    const s = await prisma.seller.findUnique({ where: { id: sellerId } });
    pct = s?.commissionPct ?? 0;
  } else if (allianceId) {
    const a = await prisma.alliance.findUnique({ where: { id: allianceId } });
    pct = a?.commissionPct ?? 0;
  }

  const rows = orders.map(o => {
    const baseCollected = calcCollectedBase(o);
    const baseExpected  = calcExpectedBase(o);

    const accruedCollected = Math.round(baseCollected * (pct / 100)); // devengada por lo cobrado
    const accruedExpected  = Math.round(baseExpected  * (pct / 100)); // total esperada (independiente del cobro)

    const paidComm = o.commissionPays
      .filter(cp => (sellerId ? cp.kind === "SELLER" : cp.kind === "ALLIANCE"))
      .reduce((a,cp)=>a+cp.amount,0);

    const balanceExpected = accruedExpected - paidComm;

    return {
      orderId: o.id,
      code: o.code,
      client: o.client?.fullName || "",
      date: o.createdAt,
      pct,
      baseCollected,
      baseExpected,
      accruedCollected,
      accruedExpected,
      paid: paidComm,
      balanceExpected,
      payments: o.commissionPays
        .filter(cp => (sellerId ? cp.kind === "SELLER" : cp.kind === "ALLIANCE"))
        .map(cp => ({ id: cp.id, amount: cp.amount, date: cp.date, notes: cp.notes }))
    };
  });

  return NextResponse.json({ pct, rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>null);
  if (!body) return NextResponse.json({ error: "JSON invÃ¡lido" }, { status: 400 });

  const { kind, sellerId, allianceId, orderId, amount, date, notes } = body as {
    kind: "SELLER" | "ALLIANCE";
    sellerId?: string; allianceId?: string;
    orderId: string; amount: number; date?: string; notes?: string;
  };

  if (!kind || !orderId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
  }
  if (kind === "SELLER" && !sellerId) {
    return NextResponse.json({ error: "sellerId requerido" }, { status: 400 });
  }
  if (kind === "ALLIANCE" && !allianceId) {
    return NextResponse.json({ error: "allianceId requerido" }, { status: 400 });
  }

  const created = await prisma.commissionPayment.create({
    data: {
      kind,
      sellerId: kind === "SELLER" ? sellerId : null,
      allianceId: kind === "ALLIANCE" ? allianceId : null,
      orderId,
      amount,
      date: date ? new Date(date) : undefined,
      notes
    }
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  await prisma.commissionPayment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

