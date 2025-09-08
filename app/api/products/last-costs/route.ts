import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/products/last-costs
 * Body: { productIds: string[] }
 * Devuelve el último unitCostNet por producto (más reciente por fecha).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const productIds: string[] = Array.isArray(body?.productIds) ? body.productIds.filter(Boolean) : [];
    if (!productIds.length) return NextResponse.json({ byProduct: {} });

    const invoices = await prisma.supplierInvoice.findMany({
      where: { items: { some: { productId: { in: productIds } } } },
      orderBy: { date: "desc" },
      take: 300,
      include: {
        items: {
          where: { productId: { in: productIds } },
          select: { productId: true, unitCostNet: true },
        },
      },
    });

    const byProduct: Record<string, number> = {};
    for (const inv of invoices) {
      for (const it of inv.items) {
        if (it.unitCostNet && byProduct[it.productId] == null) {
          byProduct[it.productId] = it.unitCostNet;
        }
      }
    }

    return NextResponse.json({ byProduct });
  } catch (e) {
    console.error("last-costs error", e);
    return NextResponse.json({ byProduct: {} }, { status: 200 });
  }
}
