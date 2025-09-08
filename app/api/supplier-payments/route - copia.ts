import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  supplierId: string;
  date?: string;
  method: string; // "CASH"|"BANK"|"DEPOSIT"|"COINPAY"|"COMPANY_FINANCING"
  amountCents: number;
  notes?: string;
  invoiceIds?: string[]; // opcional: si viene, aplica sobre esas; sino FIFO
  orderId?: string | null;
  ignoreInterest?: boolean; // para COMPANY_FINANCING (true default)
};

export async function POST(req: Request) {
  const b = await req.json() as Body;
  if (!b.supplierId || !b.amountCents) return new NextResponse("Bad request", { status: 400 });

  const pay = await prisma.supplierPayment.create({
    data: {
      supplierId: b.supplierId,
      date: b.date ? new Date(b.date) : undefined,
      method: String(b.method || "DEPOSIT"),
      amountCents: b.amountCents,
      notes: b.notes ?? null,
      orderId: b.orderId ?? null,
      ignoreInterest: b.ignoreInterest ?? true,
    },
  });

  // Traer facturas abiertas (por selecciÃ³n o FIFO)
  let invoices = await prisma.supplierInvoice.findMany({
    where: {
      supplierId: b.supplierId,
      id: b.invoiceIds && b.invoiceIds.length ? { in: b.invoiceIds } : undefined,
      status: { in: ["OPEN", "PARTIAL"] },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // si se especificaron ids, respetamos ese orden
  if (b.invoiceIds && b.invoiceIds.length) {
    const idx = new Map(b.invoiceIds.map((id, i) => [id, i]));
    invoices = invoices.sort((a, z) => (idx.get(a.id) ?? 0) - (idx.get(z.id) ?? 0));
  }

  let left = b.amountCents;
  for (const inv of invoices) {
    if (left <= 0) break;
    const remaining = inv.amountGross - inv.paidCents;
    if (remaining <= 0) continue;
    const apply = Math.min(left, remaining);

    await prisma.$transaction([
      prisma.supplierPaymentApplication.create({
        data: { paymentId: pay.id, invoiceId: inv.id, amountCents: apply },
      }),
      prisma.supplierInvoice.update({
        where: { id: inv.id },
        data: {
          paidCents: inv.paidCents + apply,
          status: inv.paidCents + apply >= inv.amountGross ? "PAID" : "PARTIAL",
        },
      }),
    ]);

    left -= apply;
  }

  return NextResponse.json({ payment: pay, appliedCents: b.amountCents - left, pendingCents: left });
}
