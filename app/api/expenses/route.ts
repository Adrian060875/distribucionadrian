import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId") || undefined;
  const kind = searchParams.get("kind") || undefined; // "SERVICE" | "JV"
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

  const rows = await prisma.expenseInvoice.findMany({
    where,
    orderBy: { date: "desc" }
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { orderId, kind, supplier, description, amountNet, vatPct = 21, date, isPaid = false, paidAt } = body as any;
  if (!kind || !supplier || typeof amountNet !== "number") {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  const amountGross = Math.round(amountNet * (1 + (vatPct || 0) / 100));
  const row = await prisma.expenseInvoice.create({
    data: { orderId: orderId || null, kind, supplier, description, amountNet, vatPct, amountGross, date: date ? new Date(date) : undefined, isPaid, paidAt: paidAt ? new Date(paidAt) : null }
  });
  return NextResponse.json(row, { status: 201 });
}

