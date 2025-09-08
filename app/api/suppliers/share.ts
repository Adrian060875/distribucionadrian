import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SUPPLIERS = path.join(DATA_DIR, "suppliers.json");

export async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(SUPPLIERS); } catch { await fs.writeFile(SUPPLIERS, "[]", "utf-8"); }
}

export type Supplier = {
  id: string;
  name: string;
  cuit?: string;
  phone?: string;
  balance?: number; // opcional
};

export async function readSuppliers(): Promise<Supplier[]> {
  const raw = await fs.readFile(SUPPLIERS, "utf-8");
  try { return JSON.parse(raw) as Supplier[]; } catch { return []; }
}

export async function writeSuppliers(list: Supplier[]) {
  await fs.writeFile(SUPPLIERS, JSON.stringify(list, null, 2), "utf-8");
}
