import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const del = await prisma.commissionPayment.delete({ where: { id } });
    return NextResponse.json(del);
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 400 });
  }
}
