// lib/commissions.ts
// Utilidades comunes para cálculo de base y comisiones

export function computeOrderBase(order: any): number {
  if (order?.items?.length) {
    return order.items.reduce((acc: number, it: any) => {
      const price = Number(it?.price ?? 0);
      const qty = Number(it?.qty ?? 0);
      const discount = Number(it?.discount ?? 0);
      const subtotal =
        it?.subtotal != null ? Number(it.subtotal) : price * qty - discount;
      return acc + (isNaN(subtotal) ? 0 : subtotal);
    }, 0);
  }
  const ta = Number(order?.totalAmount ?? 0);
  return isNaN(ta) ? 0 : ta;
}

export function calcCommission(base: number, pct: number): number {
  const v = Number(base) * (Number(pct) / 100);
  return Number.isFinite(v) ? Number(v.toFixed(2)) : 0;
}
