import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// PATCH /api/suppliers/:id
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const name = (body?.name || "").toString().trim();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

    const updated = await prisma.supplier.update({
      where: { id: params.id },
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("SUPPLIERS PATCH", e);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}

// DELETE /api/suppliers/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    // Eliminación dura; si el proveedor está en uso, Prisma lanzará error de FK.
    await prisma.supplier.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("SUPPLIERS DELETE", e);
    // Si está referenciado (facturas, etc.) devolvemos 409
    return NextResponse.json({ error: "Proveedor en uso: no se puede eliminar." }, { status: 409 });
  }
}
