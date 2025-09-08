import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const inv = await prisma.supplierInvoice.findMany({
    where: { supplierId: params.id },
    orderBy: { date: "desc" },
    select: {
      id: true, date: true, kind: true, docType: true, pos: true, number: true, vatPct: true,
      amountNet: true, amountVat: true, amountGross: true, paidCents: true, status: true,
      orderId: true,
    }
  });
  return NextResponse.json(inv);
}
