// app/api/alliances/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeOrderBase, calcCommission } from "../../../lib/commissions";

// LISTAR
export async function GET() {
  try {
    const alliances = await prisma.alliance.findMany({
      orderBy: { name: "asc" },
      include: { orders: { include: { items: true } } },
    });

    const ids = alliances.map((a) => a.id);
    const clientAny = prisma as any;
    const hasCommission = typeof clientAny?.commission?.findMany === "function";
    const hasCommissionPay = typeof clientAny?.commissionPay?.findMany === "function";

    let commissions: any[] = [];
    if (hasCommission) {
      commissions = await clientAny.commission.findMany({
        where: { allianceId: { in: ids } },
        select: { allianceId: true, status: true, amount: true, orderId: true },
      });
    } else if (hasCommissionPay) {
      commissions = await clientAny.commissionPay.findMany({
        where: { allianceId: { in: ids } },
        select: { allianceId: true, status: true, amount: true, orderId: true },
      });
    }

    const sums: Record<string, { pending: number; paid: number }> = {};
    for (const c of commissions) {
      const k = c.allianceId as string;
      if (!sums[k]) sums[k] = { pending: 0, paid: 0 };
      const amt = Number(c.amount ?? 0);
      const st = String(c.status ?? (c.paid ? "PAID" : "PENDING")).toUpperCase();
      if (st === "PAID") sums[k].paid += amt; else sums[k].pending += amt;
    }

    const data = alliances.map((a: any) => {
      const baseSum = a.orders.reduce((acc: number, o: any) => acc + computeOrderBase(o), 0);
      const pct = Number(a.commissionPct ?? 0);
      const theoretical = calcCommission(baseSum, pct);
      const s = sums[a.id] ?? { pending: 0, paid: 0 };
      const pending = Number(s.pending.toFixed(2));
      const paid = Number(s.paid.toFixed(2));
      const remaining = Math.max(theoretical - paid, 0);
      return {
        id: a.id,
        name: a.name,
        commissionPct: pct,
        phone: (a as any).phone ?? null,
        email: (a as any).email ?? null,
        totals: { theoretical, pending, paid, remaining },
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}

// CREAR
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const commissionPct = Number(body?.commissionPct ?? 0);
    const phone = body?.phone ? String(body.phone).trim() : undefined;
    const email = body?.email ? String(body.email).trim() : undefined;

    if (!name) return NextResponse.json({ ok: false, error: "Nombre requerido" }, { status: 400 });
    if (!Number.isFinite(commissionPct) || commissionPct < 0) return NextResponse.json({ ok: false, error: "ComisiÃƒÂ³n invÃƒÂ¡lida" }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, error: "Email invÃƒÂ¡lido" }, { status: 400 });

    const data: any = { name, commissionPct };
    if (phone) data.phone = phone;
    if (email) data.email = email;

    try {
      const created = await prisma.alliance.create({
        data,
        select: { id: true, name: true, commissionPct: true, phone: true, email: true },
      });
      return NextResponse.json({ ok: true, data: created });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("Unknown arg `phone`") || msg.includes("Unknown arg `email`")) {
        const created = await prisma.alliance.create({
          data: { name, commissionPct },
          select: { id: true, name: true, commissionPct: true },
        });
        return NextResponse.json({ ok: true, data: created, warn: "Schema sin phone/email: se creÃƒÂ³ sin esos campos." });
      }
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}

// EDITAR (id en el body)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });

    const updates: any = {};
    if (typeof body?.name === "string") updates.name = body.name.trim();
    if (typeof body?.commissionPct !== "undefined") {
      const pct = Number(body.commissionPct);
      if (!Number.isFinite(pct) || pct < 0) return NextResponse.json({ ok: false, error: "ComisiÃƒÂ³n invÃƒÂ¡lida" }, { status: 400 });
      updates.commissionPct = pct;
    }
    if ("phone" in body) updates.phone = body.phone ? String(body.phone).trim() : null;
    if ("email" in body) {
      const em = body.email ? String(body.email).trim() : null;
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return NextResponse.json({ ok: false, error: "Email invÃƒÂ¡lido" }, { status: 400 });
      updates.email = em;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ ok: false, error: "Nada para actualizar" }, { status: 400 });

    try {
      const upd = await prisma.alliance.update({
        where: { id },
        data: updates,
        select: { id: true, name: true, commissionPct: true, phone: true, email: true },
      });
      return NextResponse.json({ ok: true, data: upd });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("Unknown arg `phone`") || msg.includes("Unknown arg `email`")) {
        const { phone, email, ...rest } = updates;
        const upd = await prisma.alliance.update({
          where: { id },
          data: rest,
          select: { id: true, name: true, commissionPct: true },
        });
        return NextResponse.json({ ok: true, data: upd, warn: "Schema sin phone/email: se actualizÃƒÂ³ sin esos campos." });
      }
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}

// BORRAR (id en el body)
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });

    await prisma.alliance.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const msg = String(error?.message ?? "");
    if (msg.toLowerCase().includes("foreign key") || msg.toLowerCase().includes("constraint")) {
      return NextResponse.json({ ok: false, error: "No se puede borrar: la alianza tiene datos asociados." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error?.message ?? "Error" }, { status: 500 });
  }
}

