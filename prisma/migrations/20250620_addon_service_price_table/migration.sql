-- CreateTable
CREATE TABLE "AddonServicePrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "addonServiceId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "priceInr" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AddonServicePrice_addonServiceId_tierId_key" UNIQUE ("addonServiceId", "tierId"),
    CONSTRAINT "AddonServicePrice_addonServiceId_fkey" FOREIGN KEY ("addonServiceId") REFERENCES "AddonService" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AddonServicePrice_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AddonServicePrice_tierId_idx" ON "AddonServicePrice" ("tierId");

-- CreateIndex
CREATE INDEX "AddonServicePrice_addonServiceId_idx" ON "AddonServicePrice" ("addonServiceId");

-- AlterTable: Add columns to QuoteLineItem
ALTER TABLE "QuoteLineItem" ADD COLUMN "isComplimentary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuoteLineItem" ADD COLUMN "customScope" TEXT;