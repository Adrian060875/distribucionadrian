/*
  Warnings:

  - You are about to drop the column `commissionType` on the `Alliance` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Alliance` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Alliance` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alliance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "commissionPct" REAL NOT NULL DEFAULT 0,
    "phone" TEXT,
    "email" TEXT
);
INSERT INTO "new_Alliance" ("commissionPct", "id", "name") SELECT "commissionPct", "id", "name" FROM "Alliance";
DROP TABLE "Alliance";
ALTER TABLE "new_Alliance" RENAME TO "Alliance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
