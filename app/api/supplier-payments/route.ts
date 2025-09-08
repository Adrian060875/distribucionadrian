import { NextResponse } from "next/server";
import { ensureData, files, readJson, writeJson } from "../suppliers/shared";

type Supplier = { id:string; name:string; balance?:number };
type Invoice  = { id:string; supplierId:string; amountGross:number; paidCents:number; number:string|null };
type Payment  = {
  id:string; supplierId:string; date:string; method:string; amountCents:number; notes?:string|null;
  applications:{ invoice:{ id:string, number:string|null } }[]
};

export async function POST(req: Request) {
  await ensureData();
  const body = await req.json().catch(()=>null);
  if (!body?.supplierId) return NextResponse.json("supplierId requerido", { status: 400 });
  if (!body?.amountCents || body.amountCents<=0) return NextResponse.json("Importe inválido", { status: 400 });

  const suppliers: Supplier[] = await readJson(files.SUPPLIERS);
  const invoices: Invoice[] = await readJson(files.INVOICES);
  const payments: Payment[] = await readJson(files.PAYMENTS);

  const sup = suppliers.find(s => s.id === body.supplierId);
  if (!sup) return NextResponse.json("Proveedor no encontrado", { status: 404 });

  let remaining = Number(body.amountCents);
  const selected: string[] = Array.isArray(body.invoiceIds) ? body.invoiceIds : [];

  // Orden: aplicar a facturas seleccionadas (en el orden recibido), luego al resto (por antigüedad)
  const targetInvoices = [
    ...invoices.filter(i => selected.includes(i.id) && i.supplierId === sup.id),
    ...invoices
      .filter(i => !selected.includes(i.id) && i.supplierId === sup.id)
      .sort((a,b)=> (a.date||"").localeCompare(b.date||""))
  ];

  const applications: { invoice:{ id:string, number:string|null } }[] = [];
  for (const inv of targetInvoices) {
    if (remaining<=0) break;
    const pending = Math.max(0, inv.amountGross - inv.paidCents);
    if (pending<=0) continue;
    const pay = Math.min(remaining, pending);
    inv.paidCents += pay;
    remaining -= pay;
    applications.push({ invoice: { id: inv.id, number: inv.number ?? null } });
  }

  const payment: Payment = {
    id: crypto.randomUUID(),
    supplierId: sup.id,
    date: new Date().toISOString(),
    method: String(body.method || "DEPOSIT"),
    amountCents: Number(body.amountCents),
    notes: body.notes ? String(body.notes) : null,
    applications
  };
  payments.unshift(payment);

  // (Opcional) actualizar balance simple
  sup.balance = Math.max(0, (sup.balance ?? 0) - payment.amountCents);

  await writeJson(files.INVOICES, invoices);
  await writeJson(files.PAYMENTS, payments);
  await writeJson(files.SUPPLIERS, suppliers);

  return NextResponse.json(payment, { status: 201 });
}
