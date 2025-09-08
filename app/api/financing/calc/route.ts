// app/api/financing/calc/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

/**
 * GET /api/financing/calc?orderId=&planId=&type=&downPayment=&graceDays=
 * - type: "CASH" | "IN_HOUSE" | "CARD" | "COMPANY"
 * - orderId: opcional (si no, podÃ©s mandar totalBase).
 * - planId: necesario para IN_HOUSE / CARD / COMPANY (define months, interÃ©s, etc).
 * - downPayment: centavos (opcional)
 * - graceDays: dÃ­as de gracia para 1a cuota (opcional)
 * Alternativas:
 *   GET /api/financing/calc?totalBase=123456&... (si no tenÃ©s orderId)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") || "CASH") as "CASH"|"IN_HOUSE"|"CARD"|"COMPANY";
    const orderId = searchParams.get("orderId") || undefined;
    const planId = searchParams.get("planId") || undefined;
    const downPayment = Number(searchParams.get("downPayment") || 0);
    const graceDays = Number(searchParams.get("graceDays") || 0);
    const totalBaseParam = Number(searchParams.get("totalBase") || 0);

    let totalBase = totalBaseParam;

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { totalFinal: true }
      });
      if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
      // tomamos totalFinal como base (podemos cambiar a totalList si preferÃ­s)
      totalBase = order.totalFinal || 0;
    }
    if (!totalBase || totalBase < 0) totalBase = 0;

    // CASH: no necesita plan
    if (type === "CASH") {
      const result = {
        type,
        base: totalBase,
        downPayment,
        financeBase: Math.max(0, totalBase - downPayment),
        months: 0,
        total: Math.max(0, totalBase - downPayment),
        instalments: [] as any[]
      };
      return NextResponse.json(result, { status: 200 });
    }

    if (!planId) {
      return NextResponse.json({ error: "Falta planId para este tipo de financiaciÃ³n" }, { status: 400 });
    }

    const plan = await prisma.financingPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan no encontrado o inactivo" }, { status: 404 });
    }

    const months = plan.months ?? 0;
    const interestPct = plan.interestPct ?? 0;         // % nominal del plan
    const interestKind = (plan.interestKind ?? "NONE") as "NONE"|"SIMPLE"|"COMPOUND";
    const cardFeePct = plan.cardFeePct ?? 0;

    // base financiable
    let financeBase = Math.max(0, totalBase - downPayment);

    // recargo por tarjeta (si tipo CARD)
    if (type === "CARD" && cardFeePct > 0) {
      financeBase = Math.round(financeBase * (1 + cardFeePct / 100));
    }

    // interÃ©s segÃºn kind
    let totalWithInterest = financeBase;
    if (interestKind === "SIMPLE" && interestPct > 0 && months > 0) {
      const monthly = interestPct / 100;
      totalWithInterest = Math.round(financeBase * (1 + monthly * months));
    } else if (interestKind === "COMPOUND" && interestPct > 0 && months > 0) {
      const monthly = interestPct / 100;
      totalWithInterest = Math.round(financeBase * Math.pow(1 + monthly, months));
    }

    // cuotas (todas iguales)
    const perInstalment = months > 0 ? Math.floor(totalWithInterest / months) : totalWithInterest;
    const instalments = [];
    const start = new Date();
    start.setHours(0,0,0,0);
    if (graceDays > 0) start.setDate(start.getDate() + graceDays);

    for (let i = 1; i <= Math.max(1, months); i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + (i - 1));
      instalments.push({
        number: i,
        dueDate: due.toISOString(),
        amount: perInstalment
      });
    }

    // ajustar residuo a la Ãºltima cuota
    const sum = instalments.reduce((a, it) => a + it.amount, 0);
    const diff = totalWithInterest - sum;
    if (diff !== 0 && instalments.length > 0) {
      instalments[instalments.length - 1].amount += diff;
    }

    const result = {
      type,
      plan: {
        id: plan.id,
        name: plan.name,
        planType: plan.planType,
        months,
        interestPct,
        interestKind,
        cardProvider: plan.cardProvider,
        cardPlanCode: plan.cardPlanCode,
        cardFeePct: plan.cardFeePct ?? 0,
        companyName: plan.companyName,
      },
      base: totalBase,
      downPayment,
      financeBase,
      total: totalWithInterest,
      instalments
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: "No se pudo calcular financiaciÃ³n", detail: String(err?.message || err) }, { status: 500 });
  }
}
