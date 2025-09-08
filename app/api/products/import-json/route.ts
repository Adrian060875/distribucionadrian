import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RowIn = { name: string; sku: string; costNet?: number; listPrice: number };

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) (out[k] = obj[k]);
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rows: RowIn[] = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ error: "rows vacío" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    const errors: { idx: number; error: string }[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const name = (r.name ?? "").trim();
      const sku = (r.sku ?? "").trim();
      const costNet = Math.max(Math.floor(r.costNet ?? 0), 0);
      const listPrice = Math.max(Math.floor(r.listPrice ?? 0), 0);

      if (!name || !sku) { errors.push({ idx, error: "Faltan name/sku" }); continue; }
      if (!listPrice)     { errors.push({ idx, error: "listPrice inválido" }); continue; }

      try {
        const existing = await prisma.product.findUnique({ where: { sku } });
        if (!existing) {
          await prisma.product.create({ data: { name, sku, costNet, listPrice } });
          created++;
        } else {
          await prisma.product.update({
            where: { sku },
            data: pick({ name, costNet, listPrice }, ["name", "costNet", "listPrice"]),
          });
          updated++;
        }
      } catch (e: any) {
        errors.push({ idx, error: e?.message || "Error desconocido" });
      }
    }

    return NextResponse.json({ ok: true, created, updated, errors });
  } catch (e: any) {
    console.error("IMPORT-JSON ERROR:", e);
    return NextResponse.json({ error: e?.message || "Error import-json" }, { status: 500 });
  }
}
