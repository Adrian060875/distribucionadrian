import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** PATCH: actualizar encabezado e importe (SERVICE/JV) */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();

    const kind = String(body.kind || "").toUpperCase();
    const vatPct = kind === "JV" ? 0 : Number(body.vatPct || 0);

    // si viene amountNet, recalculo totales
    let update: any = {
      kind: body.kind,
      supplierName: body.supplierName ?? null,
      cuit: body.cuit ?? null,
      docType: body.docType || "C",
      pos: body.pos ?? null,
      number: body.number ?? null,
      date: body.date ? new Date(body.date) : undefined,
      vatPct,
      notes: body.notes ?? null,
    };

    if (typeof body.amountNet === "number" && body.amountNet >= 0) {
      const net = Number(body.amountNet || 0);
      const vat = Math.round(net * (vatPct / 100));
      const gross = net + vat;
      update.amountNet = net;
      update.amountVat = vat;
      update.amountGross = gross;

      // Por prolijidad, si es SERVICE/JV ajusto el primer item si existe
      const inv = await prisma.supplierInvoice.findUnique({
        where: { id },
        include: { items: true },
      });
      if (inv && (kind === "SERVICE" || kind === "JV")) {
        const first = inv.items[0];
        if (first) {
          await prisma.supplierInvoiceItem.update({
            where: { id: first.id },
            data: { unitCostNet: net, qty: 1 },
          });
        }
      }
    }

    const saved = await prisma.supplierInvoice.update({
      where: { id },
      data: update,
    });

    return NextResponse.json(saved);
  } catch (e) {
    console.error("PATCH supplier-invoice error", e);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}

/** DELETE: borra factura + ítems */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.supplierInvoice.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE supplier-invoice error", e);
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }
}
