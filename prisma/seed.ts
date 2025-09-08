import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // ---- Seller (usar ID único fijo) ----
  await prisma.seller.upsert({
    where: { id: "seller-seed-1" },
    update: {},
    create: {
      id: "seller-seed-1",
      name: "Adrián Gianelli",
      phone: "2234389011",
      email: "adrian@example.com",
    },
  });

  // ---- Products (SKU es único en el schema, OK) ----
  await prisma.product.upsert({
    where: { sku: "RP-SARTEN-28" },
    update: {},
    create: {
      name: "Sartén 28 cm",
      sku: "RP-SARTEN-28",
      listPrice: 42000000,
      cashPrice: 36000000,
    },
  });

  await prisma.product.upsert({
    where: { sku: "RP-OLLA-24" },
    update: {},
    create: {
      name: "Olla 24 cm",
      sku: "RP-OLLA-24",
      listPrice: 65000000,
      cashPrice: 56000000,
    },
  });

  // ---- Financing Plans (usar IDs únicos fijos) ----
  await prisma.financingPlan.upsert({
    where: { id: "plan-6" },
    update: {},
    create: { id: "plan-6", name: "6 cuotas", months: 6, interestPct: 25 },
  });

  await prisma.financingPlan.upsert({
    where: { id: "plan-9" },
    update: {},
    create: { id: "plan-9", name: "9 cuotas", months: 9, interestPct: 35 },
  });

  await prisma.financingPlan.upsert({
    where: { id: "plan-12" },
    update: {},
    create: { id: "plan-12", name: "12 cuotas", months: 12, interestPct: 48 },
  });

  await prisma.financingPlan.upsert({
    where: { id: "plan-18" },
    update: {},
    create: { id: "plan-18", name: "18 cuotas", months: 18, interestPct: 72 },
  });

  console.log("Seed OK");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

