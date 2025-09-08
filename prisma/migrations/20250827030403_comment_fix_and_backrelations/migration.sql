-- CreateTable
CREATE TABLE "SupplierInvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierInvoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "orderItemId" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "costNet" INTEGER NOT NULL,
    "vatPct" INTEGER NOT NULL DEFAULT 21,
    "costGross" INTEGER NOT NULL,
    CONSTRAINT "SupplierInvoiceItem_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierInvoiceItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SupplierInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "cuit" TEXT,
    "orderId" TEXT,
    "docType" TEXT NOT NULL,
    "pos" INTEGER,
    "number" INTEGER,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountNet" INTEGER NOT NULL,
    "vatPct" INTEGER NOT NULL DEFAULT 21,
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
INSERT INTO "new_SupplierInvoice" ("amountGross", "amountNet", "amountVat", "createdAt", "cuit", "date", "docType", "id", "isPaid", "notes", "number", "paidAt", "pos", "supplierId", "supplierName", "updatedAt", "vatPct") SELECT "amountGross", "amountNet", "amountVat", "createdAt", "cuit", "date", "docType", "id", "isPaid", "notes", "number", "paidAt", "pos", "supplierId", "supplierName", "updatedAt", "vatPct" FROM "SupplierInvoice";
DROP TABLE "SupplierInvoice";
ALTER TABLE "new_SupplierInvoice" RENAME TO "SupplierInvoice";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
