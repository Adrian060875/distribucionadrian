/*
  Warnings:

  - You are about to drop the `Alliance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Client` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommissionPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FinancingPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Instalment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Seller` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SupplierInvoiceItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `allianceId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `financingPlanId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `financingType` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `sellerId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `totalFinal` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `totalList` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `totalToFinance` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Supplier` table. All the data in the column will be lost.
  - You are about to drop the column `cuit` on the `SupplierInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `isPaid` on the `SupplierInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `SupplierInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `SupplierInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `supplierName` on the `SupplierInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SupplierInvoice` table. All the data in the column will be lost.
  - You are about to alter the column `vatPct` on the `SupplierInvoice` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - Made the column `kind` on table `SupplierInvoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `supplierId` on table `SupplierInvoice` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Product_sku_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Alliance";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Client";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CommissionPayment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "FinancingPlan";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Instalment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OrderItem";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Payment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Product";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Seller";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SupplierInvoiceItem";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "orderId" TEXT,
    "ignoreInterest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierPaymentApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    CONSTRAINT "SupplierPaymentApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierPaymentApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "downPayment" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "coinpayCents" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Order" ("discount", "downPayment", "id") SELECT "discount", "downPayment", "id" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cuit" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Supplier" ("createdAt", "cuit", "id", "name", "phone", "updatedAt") SELECT "createdAt", "cuit", "id", "name", "phone", "updatedAt" FROM "Supplier";
DROP TABLE "Supplier";
ALTER TABLE "new_Supplier" RENAME TO "Supplier";
CREATE TABLE "new_SupplierInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "orderId" TEXT,
    "kind" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "docType" TEXT NOT NULL,
    "pos" INTEGER,
    "number" TEXT,
    "vatPct" INTEGER NOT NULL,
    "amountNet" INTEGER NOT NULL,
    "amountVat" INTEGER NOT NULL,
    "amountGross" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SupplierInvoice" ("amountGross", "amountNet", "amountVat", "createdAt", "date", "docType", "id", "kind", "number", "orderId", "pos", "supplierId", "vatPct") SELECT "amountGross", "amountNet", "amountVat", "createdAt", "date", "docType", "id", "kind", "number", "orderId", "pos", "supplierId", "vatPct" FROM "SupplierInvoice";
DROP TABLE "SupplierInvoice";
ALTER TABLE "new_SupplierInvoice" RENAME TO "SupplierInvoice";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentApplication_paymentId_invoiceId_key" ON "SupplierPaymentApplication"("paymentId", "invoiceId");
