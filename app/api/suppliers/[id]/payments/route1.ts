import { NextResponse } from "next/server";
import { ensureData, files, readJson } from "../../shared";

type Payment = {
  id:string; supplierId:string; date:string; method:string; amountCents:number; notes?:string|null;
  applications:{ invoice:{ id:string, number:string|null } }[]
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await ensureData();
  const all: Payment[] = await readJson(files.PAYMENTS);
  const forSup = all.filter(x => x.supplierId === params.id);
  return NextResponse.json(forSup, { status: 200 });
}
