import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Utilidad: convierte "" en null y deja los demás valores como están
function emptyToNull<T>(v: T): T | null {
  // @ts-ignore
  return v === "" ? null : v;
}

/**
 * GET /api/clients/[id]
 * Devuelve el cliente + sus órdenes (con items, pagos y cuotas)
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            payments: {
              orderBy: { createdAt: "desc" },
            },
            // ¡OJO!: en el schema el nombre correcto es "instalments" (con una sola L)
            instalments: {
              orderBy: { number: "asc" },
            },
            seller: true,
            financingPlan: true,
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente no existe" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (e) {
    console.error("CLIENT GET ERROR:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/clients/[id]
 * Actualiza campos básicos del cliente
 * Body JSON (parcial):
 * { fullName?, address?, phone?, email?, birthDate?(YYYY-MM-DD), notes? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  try {
    const body = await req.json().catch(() => ({} as any));

    // Normalizo campos
    const data: any = {};
    if (typeof body.fullName === "string") data.fullName = body.fullName.trim();
    if (typeof body.address === "string") data.address = emptyToNull(body.address?.trim());
    if (typeof body.phone === "string") data.phone = body.phone.trim();
    if (typeof body.email === "string") data.email = emptyToNull(body.email?.trim());
    if (typeof body.notes === "string") data.notes = emptyToNull(body.notes?.trim());
    if (typeof body.birthDate === "string" && body.birthDate) {
      // admite "YYYY-MM-DD"
      const d = new Date(body.birthDate);
      if (!isNaN(d.getTime())) data.birthDate = d;
    }
    // Si birthDate viene vacío, lo paso a null
    if (body.birthDate === "") data.birthDate = null;

    const updated = await prisma.client.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("CLIENT PATCH ERROR:", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}

/**
 * DELETE /api/clients/[id]
 * Elimina el cliente solo si no tiene órdenes asociadas (para no romper historial).
 * Si querés borrado forzado, avisame y lo implementamos en cascada.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  try {
    const hasOrders = await prisma.order.count({ where: { clientId: id } });
    if (hasOrders > 0) {
      return NextResponse.json(
        { error: "No se puede borrar: el cliente tiene órdenes asociadas" },
        { status: 409 }
      );
    }

    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("CLIENT DELETE ERROR:", e);
    return NextResponse.json({ error: "No se pudo borrar" }, { status: 500 });
  }
}
