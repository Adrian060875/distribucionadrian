import { z } from "zod";

export const clientCreateSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
