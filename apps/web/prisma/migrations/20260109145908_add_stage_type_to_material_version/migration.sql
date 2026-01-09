/*
  Warnings:

  - Added the required column `stage` to the `material_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `material_versions` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_material_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialPacketId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_versions_materialPacketId_fkey" FOREIGN KEY ("materialPacketId") REFERENCES "material_packets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_material_versions" ("content", "createdAt", "id", "materialPacketId", "version") SELECT "content", "createdAt", "id", "materialPacketId", "version" FROM "material_versions";
DROP TABLE "material_versions";
ALTER TABLE "new_material_versions" RENAME TO "material_versions";
CREATE INDEX "material_versions_materialPacketId_idx" ON "material_versions"("materialPacketId");
CREATE INDEX "material_versions_stage_idx" ON "material_versions"("stage");
CREATE INDEX "material_versions_type_idx" ON "material_versions"("type");
CREATE UNIQUE INDEX "material_versions_materialPacketId_version_key" ON "material_versions"("materialPacketId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
