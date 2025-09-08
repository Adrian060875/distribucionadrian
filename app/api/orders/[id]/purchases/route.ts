// app/api/orders/[id]/purchases/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Helpers */
const toNum = (v: any) => Number(String(v ?? "0").replace(",", "."));
const isIntId = (v: string) => /^\d+$/.test(v);
const normId = (v: string): any => (isIntId(v) ? Number(v) : v);
const centsToPesos = (cents?: number | null) => (Number(cents ?? 0) / 100);
const pesosToCents = (pesos?: number | null) => Math.round(Number(pesos ?? 0) * 100);

type Kind = "PROD" | "SERVICE" | "JV";

/**
 * GET /api/orders/:id/purchases
 * - invoices: compras con supplier + items(product, orderItem)
 * - totals: por tipo y total
 * - orderItemsCosts: { orderItemId, productId, productName, productCostNet }  // productCostNet en PESOS
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const orderId = normId(params.id);

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
                  // ← TU campo de costo en PRODUCT está en centavos:
                  costNet: true,
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
    const sum = (arr: any[]) => arr.reduce((a, b) => a + (Number(b.amountGross ?? b.amountNet ?? 0) || 0), 0);
    const prodGross = sum(invoices.filter(i => i.kind === "PROD"));
    const serviceGross = sum(invoices.filter(i => i.kind === "SERVICE"));
    const jvGross = sum(invoices.filter(i => i.kind === "JV"));
    const totalGross = prodGross + serviceGross + jvGross;

    // Costos actuales (PESOS) para precargar formulario de "Productos"
    const orderItemsCosts = (order.items || []).map(it => ({
      orderItemId: it.id,
      productId: it.product?.id ?? null,
      productName: it.product?.name ?? "",
      // costNet está en centavos → lo convertimos a pesos para la UI:
      productCostNet: centsToPesos((it.product as any)?.costNet),
    }));

    return NextResponse.json({
      invoices: invoices.map(inv => ({
        id: inv.id,
        kind: inv.kind as Kind,
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
        items: inv.items.map(it => ({
          id: it.id,
          description: it.description ?? null,
          qty: Number(it.qty ?? 0),
          unitCostNet: Number(it.unitCostNet ?? 0), // se guarda en PESOS
          product: it.product ? { id: it.product.id, name: it.product.name, sku: it.product.sku ?? null } : null,
          orderItemId: it.orderItemId ?? null,
        })),
      })),
      totals: { prodGross, serviceGross, jvGross, totalGross },
      orderItemsCosts,
    });
  } catch (e) {
    console.error("GET /purchases error", e);
    return NextResponse.json({ error: "No se pudo obtener compras" }, { status: 500 });
  }
}

/**
 * POST /api/orders/:id/purchases
 * Body:
 *  - kind: "PROD" | "SERVICE" | "JV"
 *  - supplierId? | (supplierName? + cuit?)
 *  - docType?, pos?, number?, date?, notes?
 *  - Si kind=PROD: items: [{ orderItemId?, productId?, qty, unitCostNet(PESOS), description? }]
 *  - Si kind=SERVICE: amountNet(PESOS), description, vatPct
 *  - Si kind=JV: amountNet(PESOS), description   (IVA 0)
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const orderId = normId(params.id);
    const body = await req.json();

    const kind = String(body.kind || "").toUpperCase() as Kind;
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
      const itemsCreate = items
        .filter((it: any) => toNum(it.qty) > 0)
        .map((it: any) => ({
          description: it.description ?? null,
          qty: toNum(it.qty),
          unitCostNet: toNum(it.unitCostNet), // PESOS
          orderItemId: it.orderItemId ?? null,
          productId: it.productId ?? null,
        }));

      if (!itemsCreate.length) {
        return NextResponse.json({ error: "Debe enviar al menos un ítem para kind=PROD" }, { status: 400 });
      }

      const amountNet = itemsCreate.reduce((a, it) => a + it.qty * it.unitCostNet, 0);
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
          items: { create: itemsCreate },
        },
        include: { items: true },
      });

      // Actualizar costo del producto (costNet en CENTAVOS) desde unitCostNet (PESOS)
      for (const it of created.items) {
        let productId: any = (it as any).productId ?? null;
        if (!productId && it.orderItemId) {
          const oi = await prisma.orderItem.findUnique({
            where: { id: it.orderItemId },
            select: { productId: true },
          });
          productId = oi?.productId ?? null;
        }
        if (productId != null) {
          await prisma.product.update({
            where: { id: productId },
            data: {
              // costNet: INT (centavos). unitCostNet llega en PESOS
              costNet: pesosToCents(it.unitCostNet as any),
            },
          });
        }
      }
    } else if (kind === "SERVICE") {
      const net = toNum(body.amountNet);
      if (!net) return NextResponse.json({ error: "Falta 'amountNet' para SERVICE" }, { status: 400 });
      const vatPct = toNum(body.vatPct); // %
      const description = String(body.description ?? "Servicio");
      const vat = Math.round((net * vatPct) * 100) / 100;
      const gross = net + vat;

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
          amountNet: net,
          amountGross: gross,
          items: {
            create: [{ description, qty: 1, unitCostNet: net, orderItemId: null, productId: null }],
          },
        },
      });
    } else {
      // JV: IVA 0
      const net = toNum(body.amountNet);
      if (!net) return NextResponse.json({ error: "Falta 'amountNet' para JV" }, { status: 400 });
      const description = String(body.description ?? "JV");

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
          amountNet: net,
          amountGross: net,
          items: {
            create: [{ description, qty: 1, unitCostNet: net, orderItemId: null, productId: null }],
          },
        },
      });
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    console.error("POST /purchases error", e);
    return NextResponse.json({ error: "No se pudo crear la compra" }, { status: 500 });
  }
}
