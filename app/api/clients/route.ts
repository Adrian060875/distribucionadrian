import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const data = await req.json();
  const fullName = (data.fullName ?? "").trim();
  const phone = (data.phone ?? "").trim();
  const email = data.email?.trim() || null;
  const notes = data.notes?.trim() || null;

  if (!fullName || !phone) {
    return NextResponse.json({ error: "Nombre y telÃ©fono son obligatorios" }, { status: 400 });
  }

  const created = await prisma.client.create({ data: { fullName, phone, email, notes } });
  return NextResponse.json(created, { status: 201 });
}

