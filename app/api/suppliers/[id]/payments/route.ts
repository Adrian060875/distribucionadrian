import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const rows = await prisma.supplierPayment.findMany({
    where: { supplierId: params.id },
    orderBy: { date: "desc" },
    include: { applications: { include: { invoice: true } } },
  });
  return NextResponse.json(rows);
}
