import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// GET /api/suppliers?q=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  // Devolvemos array simple (el frontend ya soporta array o {data:[]})
  return NextResponse.json(suppliers);
}

// POST /api/suppliers
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = (body?.name || "").toString().trim();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

    const created = await prisma.supplier.create({
      data: { name },
      select: { id: true, name: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("SUPPLIERS POST", e);
    return NextResponse.json({ error: "No se pudo crear" }, { status: 500 });
  }
}
