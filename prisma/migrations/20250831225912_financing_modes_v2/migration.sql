-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'IN_HOUSE',
    "months" INTEGER,
    "interestPct" REAL NOT NULL DEFAULT 0,
    "interestKind" TEXT NOT NULL DEFAULT 'NONE',
    "cardProvider" TEXT,
    "cardPlanCode" TEXT,
    "cardFeePct" REAL,
    "companyName" TEXT,
    "companyNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FinancingPlan" ("createdAt", "id", "interestPct", "isActive", "months", "name", "updatedAt") SELECT "createdAt", "id", "interestPct", "isActive", "months", "name", "updatedAt" FROM "FinancingPlan";
DROP TABLE "FinancingPlan";
ALTER TABLE "new_FinancingPlan" RENAME TO "FinancingPlan";
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "sellerId" TEXT,
    "allianceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "financingType" TEXT NOT NULL DEFAULT 'CASH',
    "financingPlanId" TEXT,
    "downPayment" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "totalList" INTEGER NOT NULL,
    "totalToFinance" INTEGER NOT NULL,
    "totalFinal" INTEGER NOT NULL,
    CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "Alliance" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_financingPlanId_fkey" FOREIGN KEY ("financingPlanId") REFERENCES "FinancingPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("allianceId", "clientId", "code", "createdAt", "discount", "downPayment", "financingPlanId", "financingType", "id", "sellerId", "status", "totalFinal", "totalList", "totalToFinance", "updatedAt") SELECT "allianceId", "clientId", "code", "createdAt", "discount", "downPayment", "financingPlanId", "financingType", "id", "sellerId", "status", "totalFinal", "totalList", "totalToFinance", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
