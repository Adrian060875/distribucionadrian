import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/** ========= Fallback a JSON ========= */
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
/** ================================== */

/** ========= Prisma opcional ========= */
async function getPrisma(): Promise<any|null> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    // @ts-ignore
    return new PrismaClient();
  } catch {
    return null;
  }
}
/** =================================== */

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const prisma = await getPrisma();
  if (prisma) {
    const found = await prisma.supplier.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, cuit: true, phone: true, balance: true }
    });
    if (!found) return NextResponse.json("No encontrado", { status: 404 });
    return NextResponse.json(found, { status: 200 });
  }

  await ensureData();
  const list = await readSuppliers();
  const found = list.find(s => s.id === params.id);
  if (!found) return NextResponse.json("No encontrado", { status: 404 });
  return NextResponse.json(found, { status: 200 });
}

export async function PATCH(req: Request, { params }: Params) {
  const body = await req.json().catch(() => ({} as any));
  const prisma = await getPrisma();
  if (prisma) {
    const updated = await prisma.supplier.update({
      where: { id: params.id },
      data: {
        name: body.name ?? undefined,
        cuit: body.cuit ?? undefined,
        phone: body.phone ?? undefined,
      },
      select: { id: true, name: true, cuit: true, phone: true, balance: true }
    }).catch(() => null);
    if (!updated) return NextResponse.json("No encontrado", { status: 404 });
    return NextResponse.json(updated, { status: 200 });
  }

  await ensureData();
  const list = await readSuppliers();
  const i = list.findIndex(s => s.id === params.id);
  if (i === -1) return NextResponse.json("No encontrado", { status: 404 });
  list[i] = {
    ...list[i],
    name: body.name ?? list[i].name,
    cuit: body.cuit ?? list[i].cuit,
    phone: body.phone ?? list[i].phone,
  };
  await writeSuppliers(list);
  return NextResponse.json(list[i], { status: 200 });
}

export async function DELETE(_req: Request, { params }: Params) {
  const prisma = await getPrisma();
  if (prisma) {
    // Si el proveedor tiene facturas/órdenes relacionadas, Prisma va a tirar error por FK.
    // Podés capturar y devolver 409 para indicar “en uso”.
    try {
      await prisma.supplier.delete({ where: { id: params.id } });
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e:any) {
      return NextResponse.json("No se puede eliminar (en uso)", { status: 409 });
    }
  }

  await ensureData();
  const list = await readSuppliers();
  const i = list.findIndex(s => s.id === params.id);
  if (i === -1) return NextResponse.json("No encontrado", { status: 404 });
  list.splice(i, 1);
  await writeSuppliers(list);
  return NextResponse.json({ ok: true }, { status: 200 });
}
