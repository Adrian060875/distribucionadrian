import { NextResponse } from "next/server";
// Si tenés alias configurado (tsconfig baseUrl/paths), usá esta línea:
import { prisma } from "@/lib/prisma";
// Si NO usás alias y te da error, cambiá la línea de arriba por:
// import { prisma } from "../../../../lib/prisma";

/* Utiles */
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

/* ======================
   GET /api/orders/[id]
   ====================== */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const o = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        seller: { select: { id: true, name: true, commissionPct: true } },
        alliance: { select: { id: true, name: true, commissionPct: true } } as any,
        financingPlan: true,
        items: { include: { product: true } },
        payments: true,
        instalments: { orderBy: { number: "asc" } },
      },
    });
    if (!o) return NextResponse.json({ error: "No existe" }, { status: 404 });

    /* ===== NUEVO: adjuntar último costo por ítem ===== */
    // Compras de esta orden (más recientes primero) con sus renglones
    const invsOfOrder = await prisma.supplierInvoice.findMany({
      where: { orderId: o.id },
      orderBy: { date: "desc" },
      include: {
        items: {
          select: { orderItemId: true, productId: true, unitCostNet: true },
        },
      },
    });

    const byOrderItem = new Map<string, number>();
    const byProduct = new Map<string, number>();
    for (const inv of invsOfOrder) {
      for (const it of inv.items) {
        if (it.orderItemId && it.unitCostNet && !byOrderItem.has(it.orderItemId)) {
          byOrderItem.set(it.orderItemId, it.unitCostNet);
        }
        if (it.productId && it.unitCostNet && !byProduct.has(it.productId)) {
          byProduct.set(it.productId, it.unitCostNet);
        }
      }
    }

    // Fallback: último costo global por producto (si en esta orden nunca se compró)
    const productIds = o.items.map((i: any) => i.productId).filter(Boolean);
    const missingProducts = productIds.filter((pid) => !byProduct.has(pid));
    if (missingProducts.length) {
      const globalInvs = await prisma.supplierInvoice.findMany({
        where: { items: { some: { productId: { in: missingProducts } } } },
        orderBy: { date: "desc" },
        take: 300, // limite sano
        include: {
          items: {
            where: { productId: { in: missingProducts } },
            select: { productId: true, unitCostNet: true },
          },
        },
      });
      for (const inv of globalInvs) {
        for (const it of inv.items) {
          if (it.productId && it.unitCostNet && !byProduct.has(it.productId)) {
            byProduct.set(it.productId, it.unitCostNet);
          }
        }
      }
    }

    // Adjuntar lastCostNet (centavos) a cada item
    (o.items as any) = o.items.map((it: any) => ({
      ...it,
      lastCostNet: byOrderItem.get(it.id) ?? byProduct.get(it.productId) ?? null,
    }));
    /* ===== FIN NUEVO ===== */

    // ===== tu lógica de comisiones (se deja igual) =====
    const discount = o.discount ?? 0;
    const baseWithoutInterest = Math.max(o.totalList - discount, 0); // venta neta de descuento
    const collectedToDate =
      (o.downPayment ?? 0) + o.payments.reduce((a, p) => a + (p.amount || 0), 0);

    const commissionable = Math.min(collectedToDate, baseWithoutInterest);

    const sellerPct = o.seller?.commissionPct ?? 0;
    let alliancePct = (o as any)?.alliance?.commissionPct ?? 0;
    if (!alliancePct && (o as any)?.allianceId) {
      const ally = await prisma.alliance.findUnique({
        where: { id: (o as any).allianceId },
        select: { commissionPct: true, id: true, name: true },
      });
      alliancePct = ally?.commissionPct ?? 0;
      (o as any).alliance = ally
        ? { id: ally.id, name: ally.name, commissionPct: ally.commissionPct }
        : null;
    }

    const sellerCommissionDue = Math.round(commissionable * (sellerPct / 100));
    const allianceCommissionDue = Math.round(commissionable * (alliancePct / 100));

    return NextResponse.json({
      ...o,
      sellerCommissionDue,
      allianceCommissionDue,
      commissionContext: {
        baseWithoutInterest,
        collectedToDate,
        commissionable,
        sellerPct,
        alliancePct,
      },
    });
  } catch (e) {
    console.error("ORDER GET ERROR:", e);
    return NextResponse.json({ error: "Error al obtener la orden" }, { status: 500 });
  }
}

/* ==========================
   PATCH /api/orders/[id]
   ========================== */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const {
      sellerId,
      allianceId,
      items, // [{ id?, productId, quantity }]
      downPayment,
      discount,
      financingPlanId, // string | null
      regenerateInstalments = true,
    } = body as {
      sellerId?: string | null;
      allianceId?: string | null;
      items?: { id?: string; productId: string; quantity: number }[];
      downPayment?: number | string;
      discount?: number | string;
      financingPlanId?: string | null;
      regenerateInstalments?: boolean;
    };

    const current = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true, financingPlan: true },
    });
    if (!current) return NextResponse.json({ error: "No existe" }, { status: 404 });

    // reconciliar items (opcional)
    let nextItems = current.items;
    if (items) {
      const productIds = items.map(i => i.productId);
      const prods = await prisma.product.findMany({ where: { id: { in: productIds } } });
      const prodMap = new Map(prods.map(p => [p.id, p]));

      const incomingIds = new Set(items.filter(i => i.id).map(i => i.id!));
      const toDelete = current.items.filter(ci => !incomingIds.has(ci.id)).map(ci => ci.id);
      if (toDelete.length) {
        await prisma.orderItem.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const i of items) {
        const p = prodMap.get(i.productId);
        if (!p) return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
        const qty = Number.isFinite(i.quantity) && i.quantity > 0 ? Math.floor(i.quantity) : 1;
        const unitPrice = p.listPrice;
        const subtotal = unitPrice * qty;

        if (i.id) {
          await prisma.orderItem.update({
            where: { id: i.id },
            data: { productId: p.id, quantity: qty, unitPrice, subtotal },
          });
        } else {
          await prisma.orderItem.create({
            data: { orderId: current.id, productId: p.id, quantity: qty, unitPrice, subtotal },
          });
        }
      }
      nextItems = await prisma.orderItem.findMany({ where: { orderId: current.id } });
    }

    const totalList = nextItems.reduce((a, b) => a + b.subtotal, 0);
    const dp = downPayment !== undefined ? toCents(downPayment) : current.downPayment;
    const disc = discount !== undefined ? toCents(discount) : current.discount;

    const plan =
      financingPlanId === null
        ? null
        : financingPlanId
        ? await prisma.financingPlan.findUnique({ where: { id: financingPlanId } })
        : current.financingPlan;

    const baseAfterDiscount = Math.max(totalList - disc, 0);
    const financedBase = Math.max(baseAfterDiscount - dp, 0);
    const totalFinal = plan ? withInterest(financedBase, plan.interestPct) : financedBase;

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.order.update({
        where: { id: current.id },
        data: {
          sellerId: sellerId ?? null,
          allianceId: allianceId !== undefined ? allianceId : (current as any).allianceId ?? null,
          financingPlanId: plan ? plan.id : null,
          financingType: plan ? "INSTALMENTS" : "NONE",
          downPayment: dp,
          discount: disc,
          totalList,
          totalToFinance: financedBase,
          totalFinal,
        },
        include: { items: true, financingPlan: true },
      });

      if (regenerateInstalments) {
        await tx.instalment.deleteMany({ where: { orderId: current.id } });
        if (plan && financedBase > 0) {
          const count = plan.months;
          const per = Math.floor(totalFinal / count);
          const remainder = totalFinal - per * count;
          const instalments = Array.from({ length: count }).map((_, idx) => {
            const amount = idx === count - 1 ? per + remainder : per;
            const due = new Date();
            due.setMonth(due.getMonth() + (idx + 1));
            return { orderId: current.id, number: idx + 1, dueDate: due, amount };
          });
          await tx.instalment.createMany({ data: instalments });
        }
      }
      return up;
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("ORDER PATCH ERROR:", e);
    return NextResponse.json({ error: "No se pudo modificar la orden" }, { status: 500 });
  }
}

/* ==========================
   DELETE /api/orders/[id]
   ========================== */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId: params.id } });
      await tx.instalment.deleteMany({ where: { orderId: params.id } });
      await tx.orderItem.deleteMany({ where: { orderId: params.id } });
      await tx.order.delete({ where: { id: params.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("ORDER DELETE ERROR:", e);
    return NextResponse.json({ error: "No se pudo eliminar la orden" }, { status: 500 });
  }
}
