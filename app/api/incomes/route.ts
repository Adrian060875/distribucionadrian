import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/incomes?orderId=&kind=&from=&to=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId") || undefined;
  const kind = searchParams.get("kind") || undefined; // "INVOICED" | "EXTRA"
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = {};
  if (orderId) where.orderId = orderId;
  if (kind) where.kind = kind;
  if (from || to) {
    where.date = {};
    if (from) (where.date as any).gte = new Date(from);
    if (to)   (where.date as any).lte = new Date(to);
  }

  const rows = await prisma.incomeRecord.findMany({ where, orderBy: { date: "desc" } });
  return NextResponse.json(rows);
}

// POST { orderId, kind: "INVOICED"|"EXTRA", amountNet, vatPct=21, description?, date? }
export async function POST(req: Request) {
  const body = await req.json();
  const { orderId, kind, amountNet, vatPct = 21, description, date } = body || {};
  if (!orderId || !kind || typeof amountNet !== "number") {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  const amountGross = Math.round(amountNet * (1 + (vatPct || 0) / 100));
  const row = await prisma.incomeRecord.create({
    data: { orderId, kind, amountNet, vatPct, amountGross, description: description || null, date: date ? new Date(date) : undefined }
  });
  return NextResponse.json(row, { status: 201 });
}

