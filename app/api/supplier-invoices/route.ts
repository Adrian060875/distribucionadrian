import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET listado (filtros opcionales: from, to, orderId)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const orderId = url.searchParams.get("orderId");

  const where: any = {};
  if (from || to) where.date = {};
  if (from) (where.date as any).gte = new Date(from);
  if (to)   (where.date as any).lte = new Date(to);
  if (orderId) where.orderId = orderId;

  const list = await prisma.supplierInvoice.findMany({
    where,
    include: { supplier: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(list);
}

// POST crear factura + items
export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}));
  const {
    kind, supplierId, supplierName, cuit,
    orderId, docType, pos, number, date,
    vatPct, items, notes,
    amountNet, amountVat, amountGross,
  } = body;

  if (!orderId) return NextResponse.json({ error: "orderId requerido" }, { status: 400 });
  if (!supplierName && !supplierId) return NextResponse.json({ error: "Proveedor requerido (supplierName o supplierId)" }, { status: 400 });
  if (!number) return NextResponse.json({ error: "Número de factura requerido" }, { status: 400 });

  const its = Array.isArray(items) ? items : [];
  const net = typeof amountNet === "number"
    ? amountNet
    : its.reduce((a: number, it: any) => a + (it.qty || 0) * (it.unitCostNet || 0), 0);
  const vPct = typeof vatPct === "number" ? vatPct : 0;
  const vat = typeof amountVat === "number" ? amountVat : Math.round(net * (vPct / 100));
  const gross = typeof amountGross === "number" ? amountGross : (net + vat);

  try {
    const inv = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierInvoice.create({
        data: {
          kind: kind ?? "PROD",
          supplierId: supplierId ?? null,
          supplierName: supplierName || null,
          cuit: cuit || null,
          orderId,
          docType: docType || "FA",
          pos: typeof pos === "number" ? pos : Number(pos || 1),
          number: String(number),
          date: date ? new Date(date) : new Date(),
          vatPct: vPct,
          amountNet: net,
          amountVat: vat,
          amountGross: gross,
          isPaid: false,
          paidAt: null,
          notes: notes || null,
        },
      });

      if (its.length > 0) {
        await tx.supplierInvoiceItem.createMany({
          data: its.map((it: any) => ({
            invoiceId: created.id,
            productId: it.productId ?? null,
            orderItemId: it.orderItemId ?? null,
            description: it.description || null,
            qty: Math.max(1, Number(it.qty || 1)),
            unitCostNet: Math.max(0, Number(it.unitCostNet || 0)),
          })),
        });
      }

      return created;
    });

    return NextResponse.json(inv, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear la factura" }, { status: 500 });
  }
}
