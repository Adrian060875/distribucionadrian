import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Aseguramos Node runtime para usar 'xlsx'
export const runtime = "nodejs";
// Evita caching en dev
export const dynamic = "force-dynamic";

function parseNumberLike(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return Math.round(v);
  const s = String(v).trim();
  if (!s) return 0;

  // Remover separadores de miles comunes y normalizar decimal a punto
  const normalized = s
    .replace(/\s/g, "")
    .replace(/(?<=\d)[.,](?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const asFloat = Number(normalized);
  if (isNaN(asFloat)) return 0;
  return Math.round(asFloat * 100); // pesos -> centavos
}

function pick(obj: Record<string, any>, keys: string[]) {
  const out: Record<string, any> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

function normalizeRow(row: Record<string, any>) {
  // Mapeo flexible de cabeceras
  const mapped: Record<string, any> = {};
  const keyMap: Record<string, string> = {
    name: "name",
    nombre: "name",
    sku: "sku",
    costnet: "costNet",
    costo_sin_iva: "costNet",
    "costo sin iva": "costNet",
    costo: "costNet",
    listprice: "listPrice",
    precio_venta_con_iva: "listPrice",
    "precio venta con iva": "listPrice",
    precio: "listPrice",
  };

  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().trim();
    const dest = keyMap[norm];
    if (dest) mapped[dest] = row[k];
  }

  const name = (mapped.name ?? "").toString().trim();
  const sku = (mapped.sku ?? "").toString().trim();
  const costNet = parseNumberLike(mapped.costNet ?? 0);
  const listPrice = parseNumberLike(mapped.listPrice ?? 0);

  return { name, sku, costNet, listPrice };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Falta el archivo (campo 'file')" }, { status: 400 });
    }

    const buff = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "").toLowerCase();

    let rows: any[] = [];

    if (ext === "csv") {
      // CSV simple (coma como separador)
      const text = buff.toString("utf-8");
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return NextResponse.json({ error: "CSV vacío" }, { status: 400 });
      const headers = lines.shift()!.split(",").map(h => h.trim());
      rows = lines.map(line => {
        const cols = line.split(",").map(c => c.trim());
        const row: Record<string, any> = {};
        headers.forEach((h, i) => (row[h] = cols[i]));
        return row;
      });
    } else {
      // XLSX
      const xlsx = await import("xlsx");
      const wb = xlsx.read(buff, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(ws, { defval: "" });
    }

    let created = 0;
    let updated = 0;
    const errors: { row: number; error: string }[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const raw = rows[idx] as Record<string, any>;
      const n = normalizeRow(raw);

      if (!n.name || !n.sku) {
        errors.push({ row: idx + 2, error: "Faltan 'name' o 'sku'" }); // +2: header + 1-based
        continue;
      }
      if (n.listPrice <= 0) {
        errors.push({ row: idx + 2, error: "listPrice inválido (precio con IVA en centavos)" });
        continue;
      }

      try {
        const existing = await prisma.product.findUnique({ where: { sku: n.sku } });
        if (!existing) {
          await prisma.product.create({
            data: { name: n.name, sku: n.sku, costNet: n.costNet, listPrice: n.listPrice },
          });
          created++;
        } else {
          await prisma.product.update({
            where: { sku: n.sku },
            data: pick({ name: n.name, costNet: n.costNet, listPrice: n.listPrice }, ["name", "costNet", "listPrice"]),
          });
          updated++;
        }
      } catch (e: any) {
        errors.push({ row: idx + 2, error: e?.message || "Error desconocido" });
      }
    }

    return NextResponse.json({ ok: true, created, updated, errors });
  } catch (e: any) {
    // Log útil y respuesta clara para ver en el front
    console.error("IMPORT ERROR:", e);
    return NextResponse.json({ error: e?.message || "Error de importación" }, { status: 500 });
  }
}
