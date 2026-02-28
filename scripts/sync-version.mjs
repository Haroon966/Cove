#!/usr/bin/env node
/**
 * Single source of truth: read version from package.json and write it to
 * src-tauri/tauri.conf.json and src-tauri/Cargo.toml so the desktop app and
 * all installers use the same version.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
if (!version || typeof version !== "string") {
  console.error("scripts/sync-version.mjs: package.json has no version");
  process.exit(1);
}

// Update tauri.conf.json
const tauriPath = join(root, "src-tauri", "tauri.conf.json");
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = version;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

// Update Cargo.toml (version in [package])
const cargoPath = join(root, "src-tauri", "Cargo.toml");
let cargo = readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

console.log(`Synced version ${version} to tauri.conf.json and Cargo.toml`);
