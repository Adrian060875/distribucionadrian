// app/api/alliances/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/alliances/:id  -> obtener una alianza
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const a = await prisma.alliance.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, commissionPct: true },
    });
    if (!a) return NextResponse.json({ ok: false, error: "Alliance not found" }, { status: 404 });
    return NextResponse.json({ ok: true, data: a });
  } catch (error: any) {
    console.error("[GET /api/alliances/:id] error:", error);
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}

// PATCH /api/alliances/:id  -> actualizar { name?, commissionPct? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data: any = {};
    if (typeof body?.name === "string") data.name = String(body.name).trim();
    if (typeof body?.commissionPct !== "undefined") {
      const pct = Number(body.commissionPct);
      if (!Number.isFinite(pct) || pct < 0) return NextResponse.json({ ok: false, error: "Comisión inválida" }, { status: 400 });
      data.commissionPct = pct;
    }
    if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: "Nada para actualizar" }, { status: 400 });

    const upd = await prisma.alliance.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, commissionPct: true },
    });

    return NextResponse.json({ ok: true, data: upd });
  } catch (error: any) {
    console.error("[PATCH /api/alliances/:id] error:", error);
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}
