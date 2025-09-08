// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

/* Utils */
function toCents(input: unknown): number {
  if (input == null) return 0;
  let v: any = input;
  if (typeof v === "string") v = v.trim().replace(/[^\d.-]/g, "");
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) < 100000) return Math.round(n * 100);
  return Math.round(n);
}
function withInterest(baseCents: number, interestPct?: number | null) {
  if (!interestPct || interestPct <= 0) return baseCents;
  return Math.round(baseCents * (1 + interestPct / 100));
}

/**
 * GET /api/orders
 * Devuelve órdenes para el listado, con `amount = subtotal - discount`.
 * Acepta ?q= (id, code o nombre de cliente).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const where = q
    ? {
        OR: [
          { id: q },
          { code: { contains: q } },
          { client: { fullName: { contains: q } } },
        ],
      }
    : {};

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, fullName: true } },
      items: { select: { unitPrice: true, quantity: true } },
    },
  });

  const data = rows.map((o) => {
    const subtotal = (o.items || []).reduce(
      (a, it) => a + (it.unitPrice || 0) * (it.quantity || 0),
      0
    );
    const amount = Math.max(subtotal - (o.discount || 0), 0); // 👈 lo que querés ver en el listado
    return {
      id: o.id,
      code: o.code,
      client: o.client,
      status: o.status,
      createdAt: o.createdAt,
      discount: o.discount,
      downPayment: o.downPayment,
      totalList: o.totalList,
      totalToFinance: o.totalToFinance,
      totalFinal: o.totalFinal,
      amount, // centavos
    };
  });

  return NextResponse.json(data);
}

/**
 * POST /api/orders
 * Crea una orden con items, anticipo, descuento y plan de financiación.
 * Guarda también allianceId si viene.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      clientId,
      sellerId,
      allianceId,
      items,
      downPayment = 0,
      discount = 0,
      financingPlanId,
    } = body as {
      clientId: string;
      sellerId?: string | null;
      allianceId?: string | null;
      items: { productId: string; quantity: number }[];
      downPayment?: number | string;
      discount?: number | string;
      financingPlanId?: string | null;
    };

    if (!clientId || !items?.length) {
      return NextResponse.json(
        { error: "Faltan datos de cliente o items" },
        { status: 400 }
      );
    }

    // Traer productos y plan
    const [prods, plan] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
      }),
      financingPlanId
        ? prisma.financingPlan.findUnique({ where: { id: financingPlanId } })
        : Promise.resolve(null),
    ]);
    if (prods.length !== items.length) {
      return NextResponse.json(
        { error: "Algún producto no existe" },
        { status: 400 }
      );
    }

    // Items a guardar (unitPrice = listPrice)
    const orderItems = items.map((i) => {
      const p = prods.find((pp) => pp.id === i.productId)!;
      const qty =
        Number.isFinite(i.quantity) && i.quantity > 0
          ? Math.floor(i.quantity)
          : 1;
      const unitPrice = p.listPrice;
      const subtotal = unitPrice * qty;
      return { productId: p.id, quantity: qty, unitPrice, subtotal };
    });

    const totalList = orderItems.reduce((a, b) => a + b.subtotal, 0);
    const dp = toCents(downPayment);
    const disc = toCents(discount);

    // Base: total - descuento
    const baseAfterDiscount = Math.max(totalList - disc, 0);
    // A financiar: base - anticipo
    const financedBase = Math.max(baseAfterDiscount - dp, 0);
    // Total final con interés sobre lo financiado (si hay plan)
    const totalFinal = plan
      ? withInterest(financedBase, plan.interestPct)
      : financedBase;

    // Código simple YYYYMM-####
    const seq = Math.floor(1000 + Math.random() * 9000);
    const code = `${new Date().getFullYear()}${(new Date().getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${seq}`;

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          code,
          clientId,
          sellerId: sellerId ?? null,
          allianceId: allianceId ?? null, // 👈 importante para comisiones de alianzas
          status: "CONFIRMED",
          financingType: plan ? "INSTALMENTS" : "NONE",
          financingPlanId: plan?.id ?? null,
          downPayment: dp,
          discount: disc,
          totalList,
          totalToFinance: financedBase,
          totalFinal,
          items: { create: orderItems },
        },
        include: { items: true, financingPlan: true },
      });

      // Generar cuotas si hay plan (ancladas a createdAt)
      if (plan && financedBase > 0) {
        const baseDate = new Date(order.createdAt);
        const count = plan.months;
        const per = Math.floor(totalFinal / count);
        const remainder = totalFinal - per * count;

        const instalments = Array.from({ length: count }).map((_, idx) => {
          const amount = idx === count - 1 ? per + remainder : per;
          const due = new Date(baseDate);
          due.setMonth(due.getMonth() + (idx + 1));
          return { orderId: order.id, number: idx + 1, dueDate: due, amount };
        });

        await tx.instalment.createMany({ data: instalments });
      }

      return order;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("ORDER CREATE ERROR:", e);
    return NextResponse.json(
      { error: "No se pudo crear la orden" },
      { status: 500 }
    );
  }
}
