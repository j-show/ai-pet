#!/usr/bin/env node
/** Copy Windows release artifacts from src-tauri/target/release to the repo root dist/. */
import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

const SRC_EXE = path.join(
  PACKAGE_ROOT,
  'src-tauri',
  'target',
  'release',
  'ai-pet.exe'
);
const SRC_BUNDLE_DIR = path.join(
  PACKAGE_ROOT,
  'src-tauri',
  'target',
  'release',
  'bundle'
);

const DIST_DIR = path.join(REPO_ROOT, 'dist');
const DIST_EXE = path.join(DIST_DIR, 'ai-pet.exe');

/**
 * @param {string} p
 * @returns {Promise<boolean>}
 */
const exists = async p => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  await mkdir(DIST_DIR, { recursive: true });

  if (await exists(SRC_EXE)) {
    await cp(SRC_EXE, DIST_EXE);
    console.log(
      `copied ${path.relative(REPO_ROOT, SRC_EXE)} -> ${path.relative(
        REPO_ROOT,
        DIST_EXE
      )}`
    );
  } else {
    console.warn(`skipped ${path.relative(REPO_ROOT, SRC_EXE)} (not found)`);
  }

  if (await exists(SRC_BUNDLE_DIR)) {
    await cp(SRC_BUNDLE_DIR, DIST_DIR, { recursive: true });
    console.log(
      `copied ${path.relative(REPO_ROOT, SRC_BUNDLE_DIR)} -> ${path.relative(
        REPO_ROOT,
        DIST_DIR
      )}`
    );
  } else {
    console.warn(
      `skipped ${path.relative(REPO_ROOT, SRC_BUNDLE_DIR)} (not found)`
    );
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
