// app/api/orders/[id]/purchases/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET: lista de compras de la orden (con ítems + costos) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id;
    const invoices = await prisma.supplierInvoice.findMany({
      where: { orderId },
      orderBy: { date: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            orderItem: { select: { id: true } },
          },
        },
      },
    });

    // Totales por tipo
    let totalGross = 0, prodGross = 0, serviceGross = 0, jvGross = 0;
    for (const inv of invoices) {
      totalGross += inv.amountGross || 0;
      const k = String(inv.kind || "PROD").toUpperCase();
      if (k === "SERVICE") serviceGross += inv.amountGross || 0;
      else if (k === "JV") jvGross += inv.amountGross || 0;
      else prodGross += inv.amountGross || 0;
    }

    return NextResponse.json({
      invoices,
      totals: { totalGross, prodGross, serviceGross, jvGross },
    });
  } catch (e) {
    console.error("GET purchases error", e);
    return NextResponse.json({ error: "No se pudieron obtener las compras" }, { status: 500 });
  }
}

/** POST: alta de compra asociada a la orden */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id;
    const body = await req.json();

    const {
      kind,
      supplierId,
      supplierName,
      cuit,
      docType,
      pos,
      number,
      date,
      vatPct,
      notes,
      items,        // para PROD: [{ orderItemId, productId, qty, unitCostNet }]
      amountNet,    // para SERVICE: neto. Para JV: final (sin IVA)
      description,  // SERVICE/JV
    } = body as any;

    let amountNetCents = 0;
    let amountVatCents = 0;
    let amountGrossCents = 0;

    let created;

    if ((kind || "PROD").toUpperCase() === "PROD") {
      // calcular totales desde ítems
      amountNetCents = (items || []).reduce((a: number, it: any) => a + (Number(it.unitCostNet || 0) * Number(it.qty || 0)), 0);
      const iva = Number(vatPct || 0);
      amountVatCents = Math.round(amountNetCents * (iva / 100));
      amountGrossCents = amountNetCents + amountVatCents;

      created = await prisma.supplierInvoice.create({
        data: {
          orderId,
          kind: "PROD",
          supplierId: supplierId || null,
          supplierName: supplierId ? null : (supplierName || null),
          cuit: supplierId ? null : (cuit || null),
          docType: docType || "C",
          pos: pos ?? null,
          number: number ?? null,
          date: date ? new Date(date) : new Date(),
          vatPct: iva,
          amountNet: amountNetCents,
          amountVat: amountVatCents,
          amountGross: amountGrossCents,
          notes: notes || null,
          items: {
            create: (items || []).map((it: any) => ({
              orderItemId: it.orderItemId,
              productId: it.productId || null,
              description: null,
              qty: Number(it.qty || 0),
              unitCostNet: Number(it.unitCostNet || 0),
            })),
          },
        },
      });
    } else if (String(kind).toUpperCase() === "SERVICE") {
      const iva = Number(vatPct || 0);
      amountNetCents = Number(amountNet || 0);
      amountVatCents = Math.round(amountNetCents * (iva / 100));
      amountGrossCents = amountNetCents + amountVatCents;

      created = await prisma.supplierInvoice.create({
        data: {
          orderId,
          kind: "SERVICE",
          supplierId: supplierId || null,
          supplierName: supplierId ? null : (supplierName || null),
          cuit: supplierId ? null : (cuit || null),
          docType: docType || "C",
          pos: pos ?? null,
          number: number ?? null,
          date: date ? new Date(date) : new Date(),
          vatPct: iva,
          amountNet: amountNetCents,
          amountVat: amountVatCents,
          amountGross: amountGrossCents,
          notes: notes || null,
          items: { create: [{ description: description || "Servicio", qty: 1, unitCostNet: amountNetCents }] },
        },
      });
    } else {
      // JV: IVA 0, amountNet es final
      amountNetCents = Number(amountNet || 0);
      amountVatCents = 0;
      amountGrossCents = amountNetCents;

      created = await prisma.supplierInvoice.create({
        data: {
          orderId,
          kind: "JV",
          supplierId: supplierId || null,
          supplierName: supplierId ? null : (supplierName || null),
          cuit: supplierId ? null : (cuit || null),
          docType: docType || "C",
          pos: pos ?? null,
          number: number ?? null,
          date: date ? new Date(date) : new Date(),
          vatPct: 0,
          amountNet: amountNetCents,
          amountVat: 0,
          amountGross: amountGrossCents,
          notes: notes || null,
          items: { create: [{ description: description || "Joint Venture", qty: 1, unitCostNet: amountNetCents }] },
        },
      });
    }

    return NextResponse.json(created);
  } catch (e) {
    console.error("POST purchases error", e);
    return NextResponse.json({ error: "No se pudo crear la compra" }, { status: 500 });
  }
}
