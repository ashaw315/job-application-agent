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
    "diffBaseVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "material_versions_materialPacketId_fkey" FOREIGN KEY ("materialPacketId") REFERENCES "material_packets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "material_versions_diffBaseVersionId_fkey" FOREIGN KEY ("diffBaseVersionId") REFERENCES "material_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_material_versions" ("content", "createdAt", "id", "materialPacketId", "stage", "type", "version") SELECT "content", "createdAt", "id", "materialPacketId", "stage", "type", "version" FROM "material_versions";
DROP TABLE "material_versions";
ALTER TABLE "new_material_versions" RENAME TO "material_versions";
CREATE INDEX "material_versions_materialPacketId_idx" ON "material_versions"("materialPacketId");
CREATE INDEX "material_versions_stage_idx" ON "material_versions"("stage");
CREATE INDEX "material_versions_type_idx" ON "material_versions"("type");
CREATE INDEX "material_versions_diffBaseVersionId_idx" ON "material_versions"("diffBaseVersionId");
CREATE UNIQUE INDEX "material_versions_materialPacketId_version_key" ON "material_versions"("materialPacketId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
