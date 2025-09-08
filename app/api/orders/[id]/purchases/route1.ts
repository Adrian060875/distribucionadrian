// app/api/orders/[id]/purchases/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Utilidades */
const toNumber = (v: any) => Number(String(v ?? "0").replace(",", ".")) || 0;
const sum = (xs: number[]) => xs.reduce((a, b) => a + (b || 0), 0);

/**
 * GET /api/orders/:id/purchases
 * Devuelve:
 *  - invoices: compras con supplier + items(product, orderItem)
 *  - totals: por tipo y total
 *  - orderItemsCosts: costos actuales de los productos de la orden (para precargar formulario de PROD)
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id;

    const [order, invoices] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  // <-- CAMBIAR si tu campo de costo tiene otro nombre
                  costPesos: true,
                },
              },
            },
          },
        },
      }),
      prisma.supplierInvoice.findMany({
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
      }),
    ]);

    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    // Totales por tipo
    const byKind = (k: "PROD" | "SERVICE" | "JV") =>
      invoices.filter((i) => i.kind === k);
    const prodGross = sum(byKind("PROD").map((i) => Number(i.amountGross ?? i.amountNet ?? 0)));
    const serviceGross = sum(byKind("SERVICE").map((i) => Number(i.amountGross ?? i.amountNet ?? 0)));
    const jvGross = sum(byKind("JV").map((i) => Number(i.amountGross ?? i.amountNet ?? 0)));
    const totalGross = prodGross + serviceGross + jvGross;

    // Costos actuales de productos para precargar el form de Productos
    const orderItemsCosts = (order.items || []).map((it) => ({
      orderItemId: it.id,
      productId: it.product?.id ?? null,
      productName: it.product?.name ?? "",
      // <-- CAMBIAR si tu campo de costo tiene otro nombre
      productCostNet: Number(it.product?.costPesos ?? 0),
    }));

    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        kind: inv.kind as "PROD" | "SERVICE" | "JV",
        supplierId: inv.supplierId,
        supplierName: inv.supplier?.name ?? inv.supplierName ?? null,
        cuit: inv.cuit ?? null,
        docType: inv.docType ?? null,
        pos: inv.pos ?? null,
        number: inv.number ?? null,
        date: inv.date ? inv.date.toISOString().slice(0, 10) : null,
        notes: inv.notes ?? null,
        amountNet: Number(inv.amountNet ?? 0),
        amountGross: Number(inv.amountGross ?? inv.amountNet ?? 0),
        vatPct: inv.vatPct ?? null,
        items: inv.items.map((it) => ({
          id: it.id,
          description: it.description ?? null,
          qty: Number(it.qty ?? 0),
          unitCostNet: Number(it.unitCostNet ?? 0),
          product: it.product ? { id: it.product.id, name: it.product.name, sku: it.product.sku ?? null } : null,
          orderItemId: it.orderItemId ?? null,
        })),
      })),
      totals: { prodGross, serviceGross, jvGross, totalGross },
      orderItemsCosts,
    });
  } catch (e) {
    console.error("GET purchases error", e);
    return NextResponse.json({ error: "No se pudo obtener compras" }, { status: 500 });
  }
}

/**
 * POST /api/orders/:id/purchases
 * Crea una compra. Si es de PRODUCTOS, además actualiza el costo del producto con el unitCostNet.
 * Body esperado:
 *  - kind: "PROD" | "SERVICE" | "JV"
 *  - supplierId? | (supplierName? + cuit?)
 *  - docType?, pos?, number?, date?, notes?
 *  - Si kind=PROD: items: [{ orderItemId?, productId?, qty, unitCostNet, description? }]
 *  - Si kind=SERVICE: amountNet, description, vatPct
 *  - Si kind=JV: amountNet, description   (IVA 0)
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id;
    const body = await req.json();

    const kind = String(body.kind || "").toUpperCase() as "PROD" | "SERVICE" | "JV";
    if (!["PROD", "SERVICE", "JV"].includes(kind)) {
      return NextResponse.json({ error: "Parámetro 'kind' inválido" }, { status: 400 });
    }

    const supplierId: string | null = body.supplierId ?? null;
    const supplierName: string | null = supplierId ? null : (body.supplierName ?? null);
    const cuit: string | null = supplierId ? null : (body.cuit ?? null);

    const docType: string | null = body.docType ?? null;
    const pos: string | null = body.pos ?? null;
    const number: string | null = body.number ?? null;
    const date: Date = body.date ? new Date(body.date) : new Date();
    const notes: string | null = body.notes ?? null;

    let created;

    if (kind === "PROD") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) {
        return NextResponse.json({ error: "Debe enviar 'items' para kind=PROD" }, { status: 400 });
      }

      const itemsCreate = items.map((it: any) => ({
        description: it.description ?? null,
        qty: toNumber(it.qty),
        unitCostNet: toNumber(it.unitCostNet),
        orderItemId: it.orderItemId ?? null,
        productId: it.productId ?? null,
      }));

      const amountNet = sum(itemsCreate.map((it) => it.qty * it.unitCostNet));
      const amountGross = amountNet; // si PROD no lleva IVA, bruto = neto

      created = await prisma.supplierInvoice.create({
        data: {
          orderId,
          kind,
          supplierId,
          supplierName,
          cuit,
          docType,
          pos,
          number,
          date,
          notes,
          amountNet,
          amountGross,
          vatPct: null,
          items: { create: itemsCreate },
        },
        include: { items: true },
      });

      // Actualizar costo del producto con el unitCostNet de cada ítem
      for (const it of created.items) {
        let productId: string | null = (it as any).productId ?? null;

        // Si no vino productId pero sí orderItemId, resolvemos el productId
        if (!productId && it.orderItemId) {
          const oi = await prisma.orderItem.findUnique({
            where: { id: it.orderItemId },
            select: { productId: true },
          });
          productId = oi?.productId ?? null;
        }

        if (productId && typeof it.unitCostNet === "number") {
          await prisma.product.update({
            where: { id: productId },
            data: {
              // <-- CAMBIAR si tu campo de costo tiene otro nombre
              costPesos: it.unitCostNet,
            },
          });
        }
      }
    } else if (kind === "SERVICE") {
      const amountNet = toNumber(body.amountNet);
      if (!amountNet) {
        return NextResponse.json({ error: "Falta 'amountNet' para SERVICE" }, { status: 400 });
      }
      const description = String(body.description ?? "Servicio");
      const vatPct = toNumber(body.vatPct);
      const amountVat = Math.round((amountNet * vatPct) / 100 * 100) / 100;
      const amountGross = amountNet + amountVat;

      created = await prisma.supplierInvoice.create({
        data: {
          orderId,
          kind,
          supplierId,
          supplierName,
          cuit,
          docType,
          pos,
          number,
          date,
          notes,
          amountNet,
          amountVat,
          amountGross,
          vatPct,
          items: {
            create: [
              { description, qty: 1, unitCostNet: amountNet, orderItemId: null, productId: null },
            ],
          },
        },
      });
    } else {
      // JV: IVA 0
      const amountNet = toNumber(body.amountNet);
      if (!amountNet) {
        return NextResponse.json({ error: "Falta 'amountNet' para JV" }, { status: 400 });
      }
      const description = String(body.description ?? "Joint Venture");
      const amountGross = amountNet;

      created = await prisma.supplierInvoice.create({
        data: {
          orderId,
          kind,
          supplierId,
          supplierName,
          cuit,
          docType,
          pos,
          number,
          date,
          notes,
          amountNet,
          amountVat: 0,
          amountGross,
          vatPct: 0,
          items: {
            create: [
              { description, qty: 1, unitCostNet: amountNet, orderItemId: null, productId: null },
            ],
          },
        },
      });
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST purchases error", e);
    return NextResponse.json({ error: "No se pudo crear la compra" }, { status: 500 });
  }
}
