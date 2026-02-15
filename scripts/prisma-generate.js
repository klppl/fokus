#!/usr/bin/env node

/**
 * Runs `prisma generate` only when needed:
 * - Prisma client doesn't exist yet
 * - Schema has changed since last generate
 *
 * Saves ~200-400ms on repeated `npm run dev` starts.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const schemaPath = path.resolve(__dirname, "..", "prisma", "schema.prisma");
const clientDir = path.resolve(__dirname, "..", "node_modules", "@prisma", "client");
const hashFile = path.resolve(__dirname, "..", "node_modules", ".prisma-schema-hash");

if (!fs.existsSync(schemaPath)) {
  console.error("prisma/schema.prisma not found");
  process.exit(1);
}

const crypto = require("crypto");
const currentHash = crypto.createHash("md5").update(fs.readFileSync(schemaPath)).digest("hex");

const clientExists = fs.existsSync(path.join(clientDir, "index.js"));
const previousHash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, "utf8").trim() : "";

if (clientExists && currentHash === previousHash) {
  console.log("[prisma] Client already up to date, skipping generate");
  process.exit(0);
}

console.log("[prisma] Generating client...");
execSync("npx prisma generate", { stdio: "inherit" });
fs.writeFileSync(hashFile, currentHash);
