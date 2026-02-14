#!/usr/bin/env node

/**
 * Copies the SQLite Prisma schema to the active schema location.
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

fs.copyFileSync(source, target);
console.log("[select-schema] Using SQLite schema");
