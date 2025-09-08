import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        createdAt: true,
        client: { select: { fullName: true } },
        totalFinal: true,
      },
    });

    const mapped = rows.map(r => ({
      id: r.id,
      code: r.code,
      date: r.createdAt,
      clientName: r.client?.fullName ?? "-",
      totalFinal: r.totalFinal ?? 0,
    }));

    return NextResponse.json(mapped);
  } catch (e) {
    console.error("LIST LITE ERROR:", e);
    return NextResponse.json([], { status: 200 });
  }
}
