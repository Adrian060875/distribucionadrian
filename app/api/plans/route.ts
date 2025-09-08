import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/plans
export async function GET() {
  const data = await prisma.financingPlan.findMany({
    orderBy: [{ isActive: "desc" }, { months: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(data);
}

// POST /api/plans
export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body?.name || "").trim();
  const months = Number(body?.months ?? 0);
  const interestPct = Number(body?.interestPct ?? 0);
  const isActive = !!body?.isActive;

  if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (months < 0) return NextResponse.json({ error: "Meses inválidos" }, { status: 400 });

  const created = await prisma.financingPlan.create({
    data: { name, months, interestPct, isActive },
  });
  return NextResponse.json(created, { status: 201 });
}
