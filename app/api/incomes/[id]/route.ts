import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { orderId, kind, amountNet, vatPct, description, date } = body || {};
  const data: any = {};
  if (orderId !== undefined) data.orderId = orderId;
  if (kind !== undefined) data.kind = kind;
  if (amountNet !== undefined) data.amountNet = amountNet;
  if (vatPct !== undefined) data.vatPct = vatPct;
  if (amountNet !== undefined || vatPct !== undefined) {
    const row = await prisma.incomeRecord.findUnique({ where: { id: params.id } });
    const net = amountNet ?? row?.amountNet ?? 0;
    const v   = vatPct ?? row?.vatPct ?? 21;
    data.amountGross = Math.round(net * (1 + v / 100));
  }
  if (description !== undefined) data.description = description;
  if (date !== undefined) data.date = date ? new Date(date) : null;

  const up = await prisma.incomeRecord.update({ where: { id: params.id }, data });
  return NextResponse.json(up);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.incomeRecord.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
