import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const id = params.id;
    const body = await req.json().catch(() => ({}));
    const unitCostNet = Number(body.unitCostNet);
    if (!Number.isFinite(unitCostNet) || unitCostNet < 0)
      return NextResponse.json({ error: "unitCostNet inválido" }, { status: 400 });

    const updated = await prisma.orderItem.update({
      where: { id },
      data: { /* si tenés un campo override, colocalo aquí */ unitPrice: undefined }, // <- no tocamos precio de venta
    });

    // Si tu schema tiene un campo especial de costo para OrderItem, reemplazalo por ese campo:
    // data: { costNetOverride: unitCostNet }

    return NextResponse.json({ ok: true, updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error actualizando ítem" }, { status: 500 });
  }
}
