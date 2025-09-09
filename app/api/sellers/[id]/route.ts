import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json().catch(()=>null);
  if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

  const data:any = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.phone !== "undefined") data.phone = body.phone || null;
  if (typeof body.email !== "undefined") data.email = body.email || null;
  if (typeof body.commissionPct !== "undefined") data.commissionPct = Number(body.commissionPct) || 0;
  if (typeof body.commissionType === "string") data.commissionType = body.commissionType;

  const updated = await prisma.seller.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    // Si tiene órdenes asociadas, prevenimos borrar
    const orders = await prisma.order.count({ where: { sellerId: id } });
    if (orders > 0) {
      return NextResponse.json(
        { error: "No se puede borrar: el vendedor tiene órdenes asociadas" },
        { status: 409 }
      );
    }
    await prisma.seller.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return NextResponse.json(
        { error: "No se puede borrar por referencias existentes" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Error al borrar" }, { status: 500 });
  }
}
