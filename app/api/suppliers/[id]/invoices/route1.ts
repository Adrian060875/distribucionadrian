import { NextResponse } from "next/server";
import { ensureData, files, readJson } from "../../shared";

type Invoice = {
  id:string; supplierId:string; date:string;
  kind:string; docType:string; pos:number|null; number:string|null;
  amountGross:number; paidCents:number; status:string; orderId?:string|null
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await ensureData();
  const all: Invoice[] = await readJson(files.INVOICES);
  const forSup = all.filter(x => x.supplierId === params.id);
  return NextResponse.json(forSup, { status: 200 });
}
