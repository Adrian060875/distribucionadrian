/*
  Warnings:

  - You are about to drop the `CommissionPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExpenseInvoice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IncomeRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `discountAmount` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `costNetOverride` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `costVatPct` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to alter the column `vatPct` on the `SupplierInvoice` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to drop the column `costGross` on the `SupplierInvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `costNet` on the `SupplierInvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `SupplierInvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `supplierInvoiceId` on the `SupplierInvoiceItem` table. All the data in the column will be lost.
  - You are about to drop the column `vatPct` on the `SupplierInvoiceItem` table. All the data in the column will be lost.
  - Made the column `number` on table `SupplierInvoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pos` on table `SupplierInvoice` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `invoiceId` to the `SupplierInvoiceItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitCostNet` to the `SupplierInvoiceItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CommissionPayment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ExpenseInvoice";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "IncomeRecord";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alliance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionPct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Alliance" ("commissionPct", "createdAt", "id", "name", "updatedAt") SELECT "commissionPct", "createdAt", "id", "name", "updatedAt" FROM "Alliance";
DROP TABLE "Alliance";
ALTER TABLE "new_Alliance" RENAME TO "Alliance";
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerId" TEXT,
    "allianceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "financingType" TEXT NOT NULL DEFAULT 'NONE',
    "financingPlanId" TEXT,
    "downPayment" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "totalList" INTEGER NOT NULL,
    "totalToFinance" INTEGER NOT NULL,
    "totalFinal" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_financingPlanId_fkey" FOREIGN KEY ("financingPlanId") REFERENCES "FinancingPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("allianceId", "clientId", "code", "createdAt", "downPayment", "financingPlanId", "financingType", "id", "sellerId", "status", "totalFinal", "totalList", "totalToFinance", "updatedAt") SELECT "allianceId", "clientId", "code", "createdAt", "downPayment", "financingPlanId", "financingType", "id", "sellerId", "status", "totalFinal", "totalList", "totalToFinance", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "orderId", "productId", "quantity", "subtotal", "unitPrice") SELECT "id", "orderId", "productId", "quantity", "subtotal", "unitPrice" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "id", "method", "orderId", "reference") SELECT "amount", "createdAt", "id", "method", "orderId", "reference" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE TABLE "new_Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENT',
    "commissionPct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Seller" ("commissionPct", "createdAt", "email", "id", "name", "phone", "updatedAt") SELECT "commissionPct", "createdAt", "email", "id", "name", "phone", "updatedAt" FROM "Seller";
DROP TABLE "Seller";
ALTER TABLE "new_Seller" RENAME TO "Seller";
CREATE TABLE "new_SupplierInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "cuit" TEXT,
    "orderId" TEXT,
    "kind" TEXT,
    "docType" TEXT NOT NULL,
    "pos" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amountNet" INTEGER NOT NULL,
    "vatPct" REAL NOT NULL,
    "amountVat" INTEGER NOT NULL,
    "amountGross" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupplierInvoice" ("amountGross", "amountNet", "amountVat", "createdAt", "cuit", "date", "docType", "id", "isPaid", "notes", "number", "orderId", "paidAt", "pos", "supplierId", "supplierName", "updatedAt", "vatPct") SELECT "amountGross", "amountNet", "amountVat", "createdAt", "cuit", "date", "docType", "id", "isPaid", "notes", "number", "orderId", "paidAt", "pos", "supplierId", "supplierName", "updatedAt", "vatPct" FROM "SupplierInvoice";
DROP TABLE "SupplierInvoice";
ALTER TABLE "new_SupplierInvoice" RENAME TO "SupplierInvoice";
CREATE TABLE "new_SupplierInvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "orderItemId" TEXT,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "unitCostNet" INTEGER NOT NULL,
    CONSTRAINT "SupplierInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierInvoiceItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupplierInvoiceItem" ("description", "id", "orderItemId", "productId") SELECT "description", "id", "orderItemId", "productId" FROM "SupplierInvoiceItem";
DROP TABLE "SupplierInvoiceItem";
ALTER TABLE "new_SupplierInvoiceItem" RENAME TO "SupplierInvoiceItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
