#!/usr/bin/env node

/**
 * Copies the SQLite Prisma schema to the active schema location.
 * Skips the copy if the target is already identical (avoids triggering prisma generate).
 */

const fs = require("fs");
const path = require("path");

const prismaDir = path.resolve(__dirname, "..", "prisma");
const source = path.join(prismaDir, "schema.sqlite.prisma");
const target = path.join(prismaDir, "schema.prisma");

if (!fs.existsSync(source)) {
  console.error(`Schema source not found: ${source}`);
  process.exit(1);
}

const sourceContent = fs.readFileSync(source);

if (fs.existsSync(target) && Buffer.compare(sourceContent, fs.readFileSync(target)) === 0) {
  console.log("[select-schema] Schema already up to date");
} else {
  fs.copyFileSync(source, target);
  console.log("[select-schema] Copied SQLite schema");
}
