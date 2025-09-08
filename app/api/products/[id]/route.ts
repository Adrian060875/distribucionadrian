import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET opcional: devolver un producto por id
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const p = await prisma.product.findUnique({ where: { id: params.id } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p);
}

// PATCH: actualizar campos (parcial)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const data = await req.json();

  // Sanitizar: sólo permitir estos campos
  const allowed = ["name", "sku", "description", "costNet", "listPrice", "cashPrice", "isActive"] as const;
  const payload: any = {};
  for (const k of allowed) {
    if (k in data) payload[k] = data[k];
  }

  // Normalizar números si llegan como string
  const toInt = (v: any) => (typeof v === "string" ? parseInt(v || "0", 10) || 0 : v);
  if ("costNet" in payload) payload.costNet = toInt(payload.costNet);
  if ("listPrice" in payload) payload.listPrice = toInt(payload.listPrice);
  if ("cashPrice" in payload) payload.cashPrice = toInt(payload.cashPrice);

  try {
    const updated = await prisma.product.update({
      where: { id: params.id },
      data: payload,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    // error típico: unique constraint por SKU duplicado
    return NextResponse.json({ error: e?.message || "Error actualizando" }, { status: 400 });
  }
}

// DELETE: borrar producto
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Si hay items/órdenes que referencian el producto, Prisma tirará error de FK
    return NextResponse.json({ error: "No se puede borrar: el producto está en uso" }, { status: 409 });
  }
}
