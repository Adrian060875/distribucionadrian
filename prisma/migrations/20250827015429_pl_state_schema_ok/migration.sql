/*
  Warnings:

  - You are about to drop the column `commissionType` on the `Alliance` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `CommissionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `commissionType` on the `Seller` table. All the data in the column will be lost.
  - Added the required column `kind` to the `CommissionPayment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ExpenseInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "kind" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "description" TEXT,
    "amountNet" INTEGER NOT NULL,
    "vatPct" INTEGER NOT NULL DEFAULT 21,
    "amountGross" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alliance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "commissionPct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Alliance" ("commissionPct", "createdAt", "id", "name", "updatedAt") SELECT "commissionPct", "createdAt", "id", "name", "updatedAt" FROM "Alliance";
DROP TABLE "Alliance";
ALTER TABLE "new_Alliance" RENAME TO "Alliance";
CREATE TABLE "new_CommissionPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sellerId" TEXT,
    "allianceId" TEXT,
    "amount" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommissionPayment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CommissionPayment_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CommissionPayment" ("allianceId", "amount", "createdAt", "id", "notes", "orderId", "sellerId") SELECT "allianceId", "amount", "createdAt", "id", "notes", "orderId", "sellerId" FROM "CommissionPayment";
DROP TABLE "CommissionPayment";
ALTER TABLE "new_CommissionPayment" RENAME TO "CommissionPayment";
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "costNetOverride" INTEGER,
    "costVatPct" INTEGER NOT NULL DEFAULT 21,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("id", "orderId", "productId", "quantity", "subtotal", "unitPrice") SELECT "id", "orderId", "productId", "quantity", "subtotal", "unitPrice" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "costNet" INTEGER NOT NULL DEFAULT 0,
    "listPrice" INTEGER NOT NULL,
    "cashPrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("cashPrice", "costNet", "createdAt", "description", "id", "isActive", "listPrice", "name", "sku", "updatedAt") SELECT "cashPrice", coalesce("costNet", 0) AS "costNet", "createdAt", "description", "id", "isActive", "listPrice", "name", "sku", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE TABLE "new_Seller" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "commissionPct" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Seller" ("commissionPct", "createdAt", "email", "id", "name", "phone", "updatedAt") SELECT "commissionPct", "createdAt", "email", "id", "name", "phone", "updatedAt" FROM "Seller";
DROP TABLE "Seller";
ALTER TABLE "new_Seller" RENAME TO "Seller";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
