import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const dateWhere = (field: "date" | "createdAt") => {
    const w: any = {};
    if (from || to) {
      w[field] = {};
      if (from) (w[field] as any).gte = new Date(from);
      if (to)   (w[field] as any).lte = new Date(to);
    }
    return w;
  };

  // IVA Ventas (Débito): ingresos facturados
  const incomes = await prisma.incomeRecord.findMany({
    where: { kind: "INVOICED", ...dateWhere("date") }
  });
  const ivaVentasBase = incomes.reduce((a, r) => a + (r.amountNet || 0), 0);
  const ivaVentas     = incomes.reduce((a, r) => a + Math.round((r.amountNet || 0) * ((r.vatPct || 0) / 100)), 0);

  // IVA Compras (Crédito): Servicios/JV
  const expenses = await prisma.expenseInvoice.findMany({
    where: { ...dateWhere("date") }
  });
  const ivaComprasServBase = expenses.reduce((a, e) => a + (e.amountNet || 0), 0);
  const ivaComprasServ     = expenses.reduce((a, e) => a + Math.round((e.amountNet || 0) * ((e.vatPct || 0) / 100)), 0);

  // IVA Compras (Crédito): Mercadería (facturas de proveedor reales)
  const purchases = await prisma.supplierInvoice.findMany({
    where: { ...dateWhere("date") }
  });
  const ivaComprasMerchBase = purchases.reduce((a, p) => a + (p.amountNet || 0), 0);
  const ivaComprasMerch     = purchases.reduce((a, p) => a + (p.amountVat || Math.round((p.amountNet || 0) * ((p.vatPct || 0)/100))), 0);

  const ivaComprasBase = ivaComprasServBase + ivaComprasMerchBase;
  const ivaCompras     = ivaComprasServ + ivaComprasMerch;

  return NextResponse.json({
    rango: { from, to },
    ventas: {
      baseNeta: ivaVentasBase,
      ivaDebito: ivaVentas
    },
    compras: {
      baseNeta: ivaComprasBase,
      detalle: {
        serviciosJV: { baseNeta: ivaComprasServBase, ivaCredito: ivaComprasServ },
        mercaderia:  { baseNeta: ivaComprasMerchBase, ivaCredito: ivaComprasMerch }
      },
      ivaCredito: ivaCompras
    },
    saldoIva: ivaVentas - ivaCompras
  });
}
