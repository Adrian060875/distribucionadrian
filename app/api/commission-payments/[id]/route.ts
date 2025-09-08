import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/commission-payments/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const pay = await prisma.commissionPayment.findUnique({ where: { id: params.id } });
    if (!pay) return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });

    await prisma.commissionPayment.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("COMMISSION_PAY_DELETE", e);
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
