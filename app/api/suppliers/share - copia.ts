import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SUPPLIERS = path.join(DATA_DIR, "suppliers.json");
const INVOICES = path.join(DATA_DIR, "supplier-invoices.json");
const PAYMENTS = path.join(DATA_DIR, "supplier-payments.json");

export async function ensureData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const f of [SUPPLIERS, INVOICES, PAYMENTS]) {
    try { await fs.access(f); } catch { await fs.writeFile(f, "[]", "utf-8"); }
  }
}

export async function readJson<T=any>(file: string): Promise<T> {
  const raw = await fs.readFile(file, "utf-8");
  try { return JSON.parse(raw); } catch { return [] as any; }
}

export async function writeJson(file: string, data: any) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export const files = { SUPPLIERS, INVOICES, PAYMENTS };
