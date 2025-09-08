import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/plans/:id
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json();

  const updated = await prisma.financingPlan.update({
    where: { id },
    data: {
      name: body?.name != null ? String(body.name).trim() : undefined,
      months: body?.months != null ? Number(body.months) : undefined,
      interestPct: body?.interestPct != null ? Number(body.interestPct) : undefined,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/plans/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const out = await prisma.financingPlan.delete({ where: { id } });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { error: "No se puede borrar: el plan está referenciado por órdenes." },
      { status: 400 }
    );
  }
}
