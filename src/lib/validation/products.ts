import { z } from "zod";

export const productCreateSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(3),
  // costo sin IVA (centavos)
  costNet: z.number().int().nonnegative(),
  // precio de venta con IVA (centavos)
  listPrice: z.number().int().nonnegative(),
  // opcional
  cashPrice: z.number().int().nonnegative().optional().default(0),
  description: z.string().optional(),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
