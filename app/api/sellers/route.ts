import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Consulta mínima y rápida: solo campos necesarios, sin include pesados
    const sellers = await prisma.seller.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, email: true, commissionPct: true },
    });
    return NextResponse.json(sellers, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 });
  }
}
