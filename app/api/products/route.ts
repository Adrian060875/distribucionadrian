import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const data = await req.json();
  // Validaciones mínimas
  if (!data?.name || !data?.sku || typeof data.listPrice !== "number") {
    return NextResponse.json({ error: "name, sku, listPrice son obligatorios" }, { status: 400 });
  }
  const created = await prisma.product.create({ data });
  return NextResponse.json(created, { status: 201 });
}
