import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sellers = await prisma.seller.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(sellers);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error listando vendedores" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

    const phone = body.phone ? String(body.phone).trim() : null;
    const email = body.email ? String(body.email).trim() : null;
    const commissionType = String(body.commissionType || "PERCENT");
    const commissionPct = Number.isFinite(Number(body.commissionPct)) ? Number(body.commissionPct) : 0;

    const created = await prisma.seller.create({
      data: { name, phone, email, commissionType, commissionPct },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error creando vendedor" }, { status: 500 });
  }
}
