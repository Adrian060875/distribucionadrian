// app/api/orders/next-code/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Devuelve el prÃƒÂ³ximo cÃƒÂ³digo de orden.
 * Estrategia:
 * 1) Si existe campo "code" en Order, leo el ÃƒÂºltimo y lo incremento (ORD-0001, ORD-0002, ...).
 * 2) Si no hay "code" o estÃƒÂ¡ vacÃƒÂ­o, uso el contador (count + 1) como fallback.
 * 3) Padding a 4 dÃƒÂ­gitos, ajustÃƒÂ¡ a gusto.
 */
function pad(n: number, size = 4) {
  return String(n).padStart(size, "0");
}

export async function GET() {
  try {
    // Intento leer el ÃƒÂºltimo por fecha de creaciÃƒÂ³n (ajustÃƒÂ¡ si preferÃƒÂ­s por ID incremental)
    const last = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      select: { code: true, id: true, createdAt: true },
    });

    let nextNum: number;

    if (last?.code) {
      // Intento extraer nÃƒÂºmero al final del code (e.g. ORD-0012 -> 12)
      const m = String(last.code).match(/(\d+)\s*$/);
      if (m) {
        nextNum = parseInt(m[1], 10) + 1;
      } else {
        // Si no matchea, uso count como respaldo
        const count = await prisma.order.count();
        nextNum = count + 1;
      }
    } else {
      const count = await prisma.order.count();
      nextNum = count + 1;
    }

    const nextCode = `ORD-${pad(nextNum)}`;
    return NextResponse.json({ code: nextCode }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "No se pudo calcular el prÃƒÂ³ximo cÃƒÂ³digo", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

