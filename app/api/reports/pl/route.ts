import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function commissionsDue(pct: number, o: any) {
  const totalList = o.totalList || 0;
  const disc = o.discountAmount || 0;
  const dp = o.downPayment || 0;
  const baseCom = Math.max(totalList - disc, 0);
  const principal = Math.max(totalList - dp - disc, 0);
  const tf = o.totalFinal || 0;
  const ratio = tf > 0 ? (principal / tf) : 1;
  const paid = (o.payments || []).reduce((a: number, p: any) => a + (p.amount || 0), 0);
  const cobrado = Math.min(baseCom, dp + Math.max(0, paid) * ratio);
  return Math.round(Math.max(0, pct) / 100 * cobrado);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const where: any = {};
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as any).gte = new Date(from);
    if (to)   (where.createdAt as any).lte = new Date(to);
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: true } },
      payments: true, expenses: true, seller: true, alliance: true
    },
    orderBy: { createdAt: "asc" }
  });

  let ventaSinInteres = 0;
  let interesTotal = 0;
  let costoMercaderia = 0;
  let gastosService = 0;
  let gastosJV = 0;
  let comVend = 0;
  let comAli  = 0;

  const detalle = orders.map(o => {
    const items = o.items.map(it => {
      const net = (it.costNetOverride ?? it.product.costNet) * it.quantity;
      const gross = Math.round(net * (1 + (it.costVatPct || 0) / 100));
      return { subtotal: it.subtotal, costGross: gross };
    });
    const vItems = items.reduce((a, x) => a + x.subtotal, 0);
    const cItems = items.reduce((a, x) => a + x.costGross, 0);
    const base = Math.max(o.totalList - o.downPayment - o.discountAmount, 0);
    const interes = Math.max(o.totalFinal - base, 0);
    const sv = (o.expenses || []).filter(e => e.kind === "SERVICE").reduce((a, e) => a + (e.amountGross || 0), 0);
    const jv = (o.expenses || []).filter(e => e.kind === "JV").reduce((a, e) => a + (e.amountGross || 0), 0);
    const vend = o.seller ? commissionsDue(o.seller.commissionPct || 0, o) : 0;
    const ali  = o.alliance ? commissionsDue(o.alliance.commissionPct || 0, o) : 0;

    ventaSinInteres += Math.max(o.totalList - o.discountAmount, 0);
    interesTotal    += interes;
    costoMercaderia += cItems;
    gastosService   += sv;
    gastosJV        += jv;
    comVend         += vend;
    comAli          += ali;

    return {
      id: o.id, code: o.code, date: o.createdAt,
      ventaSinInteres: Math.max(o.totalList - o.discountAmount, 0),
      interes,
      costoMercaderia: cItems,
      gastosService: sv,
      gastosJV: jv,
      comVend: vend,
      comAli: ali,
      utilidad: Math.max(o.totalList - o.discountAmount, 0) - cItems - sv - jv - vend - ali
    };
  });

  const utilidad = ventaSinInteres - costoMercaderia - gastosService - gastosJV - comVend - comAli;

  return NextResponse.json({
    rango: { from, to },
    totales: {
      ventaSinInteres,
      interesTotal,
      costoMercaderia,
      gastosService,
      gastosJV,
      comisionesVendedor: comVend,
      comisionesAlianza:  comAli,
      utilidad
    },
    detalle
  });
}

