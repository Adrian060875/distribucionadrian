import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function commissionsDue(pct: number, order: any) {
  const totalList = order.totalList || 0;
  const disc = order.discountAmount || 0;
  const dp = order.downPayment || 0;
  const baseComision = Math.max(totalList - disc, 0);
  const principal = Math.max(totalList - dp - disc, 0);
  const totalFinal = order.totalFinal || 0;
  const ratio = totalFinal > 0 ? (principal / totalFinal) : 1;
  const paid = (order.payments || []).reduce((a: number, p: any) => a + (p.amount || 0), 0);
  const cobradoParaComision = Math.min(baseComision, dp + Math.max(0, paid) * ratio);
  return Math.round(Math.max(0, pct) / 100 * cobradoParaComision);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const o = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      client: true, seller: true, alliance: true, financingPlan: true,
      items: { include: { product: true } },
      payments: true,
      expenses: true,
      incomes: true,
      purchaseInvoices: { include: { supplier: true, items: { include: { product: true, orderItem: true } } } }
    }
  });
  if (!o) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  const items = o.items.map(it => {
    const costNet = (it.costNetOverride ?? it.product.costNet) * it.quantity;
    const costGross = Math.round(costNet * (1 + (it.costVatPct || 0) / 100));
    return {
      orderItemId: it.id,
      productId: it.productId,
      sku: it.product.sku,
      name: it.product.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      subtotal: it.subtotal,
      costNetOverrideUnit: it.costNetOverride ?? null,
      costNetTotal: costNet,
      costVatPct: it.costVatPct || 21,
      costGrossTotal: costGross,
    };
  });

  const ventaItems = items.reduce((a, x) => a + x.subtotal, 0);
  const costoMercaderia = items.reduce((a, x) => a + x.costGrossTotal, 0);

  const baseSinInteres = Math.max(o.totalList - o.downPayment - o.discountAmount, 0);
  const interes = Math.max(o.totalFinal - baseSinInteres, 0);

  const gastosService = (o.expenses || []).filter(e => e.kind === "SERVICE").reduce((a, e) => a + (e.amountGross || 0), 0);
  const gastosJV      = (o.expenses || []).filter(e => e.kind === "JV").reduce((a, e) => a + (e.amountGross || 0), 0);

  const sellerPct = o.seller ? o.seller.commissionPct || 0 : 0;
  const alliancePct = o.alliance ? o.alliance.commissionPct || 0 : 0;
  const comVendedor = o.seller ? commissionsDue(sellerPct, o) : 0;
  const comAlianza  = o.alliance ? commissionsDue(alliancePct, o) : 0;

  const facturado = (o.incomes || []).filter(r => r.kind === "INVOICED");
  const extra     = (o.incomes || []).filter(r => r.kind === "EXTRA");

  const ivaVentasBase = facturado.reduce((a, r) => a + (r.amountNet || 0), 0);
  const ivaVentas     = facturado.reduce((a, r) => a + Math.round((r.amountNet || 0) * ((r.vatPct || 0)/100)), 0);
  const extraIngresos = extra.reduce((a, r) => a + (r.amountGross || 0), 0);

  const ingresoVentaSinInteres = Math.max(o.totalList - o.discountAmount, 0);
  const utilidad = ingresoVentaSinInteres - costoMercaderia - gastosService - gastosJV - comVendedor - comAlianza;

  // Facturas de mercadería + ítems
  const facturasMercaderia = (o.purchaseInvoices || []).map(inv => ({
    id: inv.id,
    date: inv.date,
    supplier: inv.supplier?.name || inv.supplierName || "—",
    doc: `${inv.docType} ${inv.pos ?? "—"}-${inv.number ?? "—"}`,
    amountNet: inv.amountNet,
    vatPct: inv.vatPct,
    amountVat: inv.amountVat,
    amountGross: inv.amountGross,
    items: inv.items.map(ii => ({
      id: ii.id,
      productId: ii.productId,
      orderItemId: ii.orderItemId,
      description: ii.description,
      quantity: ii.quantity,
      costNet: ii.costNet,
      vatPct: ii.vatPct,
      costGross: ii.costGross,
      productSku: ii.product?.sku || null,
      productName: ii.product?.name || null,
      mappedOrderSku: ii.orderItem?.productId ? ii.orderItem?.productId : null
    }))
  }));

  return NextResponse.json({
    order: { id: o.id, code: o.code, date: o.createdAt, client: o.client?.fullName, status: o.status },
    resumen: {
      totalLista: o.totalList,
      descuento: o.discountAmount,
      anticipo: o.downPayment,
      baseSinInteres,
      interes,
      totalFinal: o.totalFinal,
    },
    items,
    facturasMercaderia, // <-- detalle con ítems
    costos: {
      costoMercaderia, gastosService, gastosJV
    },
    comisiones: {
      vendedorPct: sellerPct, vendedorDevengado: comVendedor,
      alianzaPct: alliancePct, alianzaDevengada: comAlianza,
    },
    ingresos: {
      ventaSinInteres: ingresoVentaSinInteres,
      interesFinanciacion: interes,
      facturado: {
        registros: facturado.map(r => ({
          id: r.id, date: r.date, description: r.description,
          amountNet: r.amountNet, vatPct: r.vatPct, amountGross: r.amountGross
        })),
        baseIvaVentas: ivaVentasBase,
        ivaDebito: ivaVentas
      },
      extra: {
        registros: extra.map(r => ({
          id: r.id, date: r.date, description: r.description,
          amountGross: r.amountGross
        })),
        total: extraIngresos
      }
    },
    utilidad,
    pagos: (o.payments || []).map(p => ({ id: p.id, amount: p.amount, date: p.createdAt }))
  });
}
