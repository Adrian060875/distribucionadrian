-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "months" INTEGER,
    "interestPct" REAL NOT NULL,
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
INSERT INTO "new_FinancingPlan" ("cardFeePct", "cardPlanCode", "cardProvider", "companyName", "companyNotes", "createdAt", "id", "interestKind", "interestPct", "isActive", "months", "name", "notes", "planType", "updatedAt") SELECT "cardFeePct", "cardPlanCode", "cardProvider", "companyName", "companyNotes", "createdAt", "id", "interestKind", "interestPct", "isActive", "months", "name", "notes", "planType", "updatedAt" FROM "FinancingPlan";
DROP TABLE "FinancingPlan";
ALTER TABLE "new_FinancingPlan" RENAME TO "FinancingPlan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
