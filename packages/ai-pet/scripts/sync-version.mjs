#!/usr/bin/env node
/** Sync package.json version into Cargo.toml and Tauri config files. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

const PACKAGE_JSON = path.join(PACKAGE_ROOT, 'package.json');
const CARGO_TOML = path.join(PACKAGE_ROOT, 'src-tauri', 'Cargo.toml');
const TAURI_CONF = path.join(PACKAGE_ROOT, 'src-tauri', 'tauri.conf.json');
const TAURI_PORTABLE_CONF = path.join(
  PACKAGE_ROOT,
  'src-tauri',
  'tauri.portable.conf.json'
);

/**
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {string} filePath
 * @param {unknown} json
 * @returns {Promise<void>}
 */
async function writeJson(filePath, json) {
  const raw = `${JSON.stringify(json, null, 2)}\n`;
  await writeFile(filePath, raw, 'utf8');
}

/**
 * Update `[package].version` in Cargo.toml without touching dependency tables.
 * @param {string} cargoToml
 * @param {string} nextVersion
 * @returns {string}
 */
function updateCargoPackageVersion(cargoToml, nextVersion) {
  const lines = cargoToml.split(/\r?\n/);
  const pkgIdx = lines.findIndex(l => l.trim() === '[package]');
  if (pkgIdx === -1) {
    throw new Error('missing [package] section in Cargo.toml');
  }

  let endIdx = lines.length;
  for (let i = pkgIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      endIdx = i;
      break;
    }
  }

  let replaced = false;
  for (let i = pkgIdx + 1; i < endIdx; i++) {
    const m = /^(\s*version\s*=\s*)"(.*)"\s*$/.exec(lines[i]);
    if (m) {
      lines[i] = `${m[1]}"${nextVersion}"`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    // Insert close to the top of [package] for readability.
    lines.splice(pkgIdx + 1, 0, `version = "${nextVersion}"`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const pkg = await readJson(PACKAGE_JSON);
  const version = pkg?.version;
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error(`invalid version in ${PACKAGE_JSON}`);
  }

  // Cargo.toml
  const cargoRaw = await readFile(CARGO_TOML, 'utf8');
  const cargoNext = updateCargoPackageVersion(cargoRaw, version);
  if (
    cargoNext !== cargoRaw.replace(/\r?\n/g, '\n').replace(/(?<!\n)\s*$/, '\n')
  ) {
    await writeFile(CARGO_TOML, cargoNext, 'utf8');
  }

  // tauri.conf.json
  const tauri = await readJson(TAURI_CONF);
  tauri.version = version;
  await writeJson(TAURI_CONF, tauri);

  // tauri.portable.conf.json
  const portable = await readJson(TAURI_PORTABLE_CONF);
  portable.version = version;
  await writeJson(TAURI_PORTABLE_CONF, portable);

  console.log(`synced version to ${version}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
