import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/** ========= Fallback a JSON (si no hay Prisma) ========= */
type Supplier = {
  id: string;
  name: string;
  cuit?: string;
  phone?: string;
  balance?: number;
};
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "suppliers.json");

async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(FILE); } catch { await fs.writeFile(FILE, "[]", "utf-8"); }
}
async function readSuppliers(): Promise<Supplier[]> {
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "[]");
  try { return JSON.parse(raw) as Supplier[]; } catch { return []; }
}
async function writeSuppliers(list: Supplier[]) {
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf-8");
}
/** ===================================================== */

/** ========= Intento de usar Prisma si existe ========= */
async function getPrisma(): Promise<any|null> {
  try {
    // Import dinámico para no romper si @prisma/client no está
    const { PrismaClient } = await import("@prisma/client");
    // @ts-ignore
    return new PrismaClient();
  } catch {
    return null;
  }
}
/** ==================================================== */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();

  const prisma = await getPrisma();
  if (prisma) {
    // 🔵 Modo Prisma
    const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
    const result = await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      // ⚠️ Campos típicos; si tu modelo tiene otros, se agregan aquí
      select: { id: true, name: true, cuit: true, phone: true, balance: true }
    });
    return NextResponse.json(result, { status: 200 });
  }

  // 🟡 Fallback JSON
  await ensureData();
  const list = await readSuppliers();
  const filtered = q ? list.filter(s => (s.name || "").toLowerCase().includes(q)) : list;
  filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return NextResponse.json(filtered, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json("El nombre es obligatorio", { status: 400 });

  const prisma = await getPrisma();
  if (prisma) {
    // 🔵 Modo Prisma
    const created = await prisma.supplier.create({
      data: {
        name,
        cuit: body?.cuit ? String(body.cuit) : undefined,
        phone: body?.phone ? String(body.phone) : undefined,
        // balance opcional; si tu modelo lo maneja por trigger/cálculo, quitá esta línea
        balance: 0,
      },
      select: { id: true, name: true, cuit: true, phone: true, balance: true }
    });
    return NextResponse.json(created, { status: 201 });
  }

  // 🟡 Fallback JSON
  await ensureData();
  const list = await readSuppliers();
  const item: Supplier = {
    id: crypto.randomUUID(),
    name,
    cuit: body?.cuit ? String(body.cuit) : undefined,
    phone: body?.phone ? String(body.phone) : undefined,
    balance: 0,
  };
  list.push(item);
  await writeSuppliers(list);
  return NextResponse.json(item, { status: 201 });
}
