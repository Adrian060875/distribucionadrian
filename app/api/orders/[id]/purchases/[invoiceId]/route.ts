// app/api/orders/[id]/purchases/[invoiceId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const toNum = (v: any) => Number(String(v ?? "0").replace(",", "."));
const normId = (v: string): any => (/^\d+$/.test(v) ? Number(v) : v);
const pesosToCents = (pesos?: number | null) => Math.round(Number(pesos ?? 0) * 100);

/**
 * PATCH /api/orders/:id/purchases/:invoiceId
 * Body parcial según kind:
 *  - Comunes: supplierId?|supplierName?|cuit?|docType?|pos?|number?|date?|notes?
 *  - kind=PROD: items: [{ id?, orderItemId?, productId?, qty, unitCostNet(PESOS), description? }]
 *               (reemplaza el set de ítems completo)
 *  - kind=SERVICE: amountNet(PESOS), description, vatPct
 *  - kind=JV: amountNet(PESOS), description
 * Recalcula amountNet/amountGross y, si es PROD, actualiza product.costNet (centavos).
 */
export async function PATCH(req: Request, { params }: { params: { id: string; invoiceId: string } }) {
  try {
    const orderId = normId(params.id);
    const invoiceId = normId(params.invoiceId);
    const body = await req.json();

    // Traemos la invoice para conocer su kind
    const existing = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!existing || existing.orderId !== orderId) {
      return NextResponse.json({ error: "Factura no encontrada para la orden indicada" }, { status: 404 });
    }
    const kind = String(existing.kind || "").toUpperCase() as "PROD" | "SERVICE" | "JV";

    // Campos comunes a actualizar (opcionales)
    const commonData: any = {};
    if (body.supplierId !== undefined) { commonData.supplierId = body.supplierId || null; commonData.supplierName = null; commonData.cuit = null; }
    if (body.supplierName !== undefined) { commonData.supplierId = null; commonData.supplierName = body.supplierName || null; }
    if (body.cuit !== undefined) { commonData.cuit = body.cuit || null; }
    if (body.docType !== undefined) { commonData.docType = body.docType || null; }
    if (body.pos !== undefined) { commonData.pos = body.pos || null; }
    if (body.number !== undefined) { commonData.number = body.number || null; }
    if (body.notes !== undefined) { commonData.notes = body.notes || null; }
    if (body.date !== undefined) { commonData.date = body.date ? new Date(body.date) : existing.date; }

    let dataToUpdate: any = { ...commonData };

    if (kind === "PROD") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return NextResponse.json({ error: "Debe enviar 'items' para actualizar PROD" }, { status: 400 });

      const mapped = items
        .filter((it: any) => toNum(it.qty) > 0)
        .map((it: any) => ({
          description: it.description ?? null,
          qty: toNum(it.qty),
          unitCostNet: toNum(it.unitCostNet), // PESOS
          orderItemId: it.orderItemId ?? null,
          productId: it.productId ?? null,
        }));

      const amountNet = mapped.reduce((a: number, it: any) => a + it.qty * it.unitCostNet, 0);
      const amountGross = amountNet;

      // Reemplazamos ítems atómicamente
      const updated = await prisma.$transaction(async (tx) => {
        // 1) Actualizamos cabecera
        const inv = await tx.supplierInvoice.update({
          where: { id: invoiceId },
          data: { ...dataToUpdate, amountNet, amountGross },
        });

        // 2) Borramos ítems previos y creamos los nuevos
        await tx.supplierInvoiceItem.deleteMany({ where: { supplierInvoiceId: invoiceId } });
        const createdItems = await Promise.all(
          mapped.map((m: any) =>
            tx.supplierInvoiceItem.create({
              data: { ...m, supplierInvoiceId: invoiceId },
            })
          )
        );

        // 3) Actualizamos costo de product (costNet en centavos) según cada unitCostNet (PESOS)
        for (const it of createdItems) {
          let productId: any = it.productId ?? null;
          if (!productId && it.orderItemId) {
            const oi = await tx.orderItem.findUnique({ where: { id: it.orderItemId }, select: { productId: true } });
            productId = oi?.productId ?? null;
          }
          if (productId != null) {
            await tx.product.update({
              where: { id: productId },
              data: { costNet: pesosToCents(it.unitCostNet as any) }, // <-- costNet en centavos
            });
          }
        }

        return inv;
      });

      return NextResponse.json({ ok: true, id: updated.id });
    }

    if (kind === "SERVICE") {
      const net = body.amountNet !== undefined ? toNum(body.amountNet) : Number(existing.amountNet ?? 0);
      const vatPct = body.vatPct !== undefined ? toNum(body.vatPct) : 0;
      const description = body.description !== undefined ? String(body.description || "Servicio") : "Servicio";
      const vat = Math.round((net * vatPct) * 100) / 100;
      const gross = net + vat;

      await prisma.$transaction(async (tx) => {
        await tx.supplierInvoice.update({
          where: { id: invoiceId },
          data: { ...dataToUpdate, amountNet: net, amountGross: gross },
        });
        // mantenemos un ítem "único" representativo
        const firstItem = await tx.supplierInvoiceItem.findFirst({ where: { supplierInvoiceId: invoiceId } });
        if (firstItem) {
          await tx.supplierInvoiceItem.update({
            where: { id: firstItem.id },
            data: { description, qty: 1, unitCostNet: net, orderItemId: null, productId: null },
          });
        } else {
          await tx.supplierInvoiceItem.create({
            data: { supplierInvoiceId: invoiceId, description, qty: 1, unitCostNet: net },
          });
        }
      });
      return NextResponse.json({ ok: true, id: invoiceId });
    }

    // kind === "JV" (IVA 0)
    const net = body.amountNet !== undefined ? toNum(body.amountNet) : Number(existing.amountNet ?? 0);
    const description = body.description !== undefined ? String(body.description || "JV") : "JV";
    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: { ...dataToUpdate, amountNet: net, amountGross: net },
      });
      const firstItem = await tx.supplierInvoiceItem.findFirst({ where: { supplierInvoiceId: invoiceId } });
      if (firstItem) {
        await tx.supplierInvoiceItem.update({
          where: { id: firstItem.id },
          data: { description, qty: 1, unitCostNet: net, orderItemId: null, productId: null },
        });
      } else {
        await tx.supplierInvoiceItem.create({
          data: { supplierInvoiceId: invoiceId, description, qty: 1, unitCostNet: net },
        });
      }
    });
    return NextResponse.json({ ok: true, id: invoiceId });
  } catch (e) {
    console.error("PATCH purchases/:invoiceId error", e);
    return NextResponse.json({ error: "No se pudo actualizar la factura" }, { status: 500 });
  }
}

/**
 * DELETE /api/orders/:id/purchases/:invoiceId
 * Borra la factura con sus ítems.
 * (No “deshace” el costo de los productos; si querés revertir costos, decime y te lo agrego con una política.)
 */
export async function DELETE(_req: Request, { params }: { params: { id: string; invoiceId: string } }) {
  try {
    const orderId = normId(params.id);
    const invoiceId = normId(params.invoiceId);

    const existing = await prisma.supplierInvoice.findUnique({ where: { id: invoiceId } });
    if (!existing || existing.orderId !== orderId) {
      return NextResponse.json({ error: "Factura no encontrada para la orden indicada" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.supplierInvoiceItem.deleteMany({ where: { supplierInvoiceId: invoiceId } }),
      prisma.supplierInvoice.delete({ where: { id: invoiceId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE purchases/:invoiceId error", e);
    return NextResponse.json({ error: "No se pudo eliminar la factura" }, { status: 500 });
  }
}
