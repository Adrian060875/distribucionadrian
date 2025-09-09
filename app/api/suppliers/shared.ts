// app/api/suppliers/shared.ts
import fs from "fs";
import path from "path";

export type Supplier = {
  id: string;
  name: string;
  cuit?: string | null;
};

// Rutas lógicas usadas por otros módulos (stub seguro)
export const files = {
  suppliers: "data/suppliers.json",
  supplierPayments: "data/supplier-payments.json",
};

let suppliers: Supplier[] = [];

export async function ensureData() {
  // Si quisieras leer de disco en local, descomentá:
  // try {
  //   const p = path.resolve(process.cwd(), files.suppliers);
  //   if (fs.existsSync(p)) suppliers = JSON.parse(fs.readFileSync(p, "utf8"));
  // } catch {}
}

export async function readSuppliers(): Promise<Supplier[]> {
  return suppliers;
}

export async function writeSuppliers(next: Supplier[]) {
  suppliers = next;
  // En Vercel el FS es efímero; no persiste. En local podés persistir:
  // await writeJson(files.suppliers, next);
}

export async function writeJson(relPath: string, data: any) {
  try {
    const abs = path.resolve(process.cwd(), relPath);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // No-op si no se puede escribir
  }
}