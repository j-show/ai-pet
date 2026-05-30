#!/usr/bin/env node
/**
 * Sync the default pet package from packages/pet-skins/<defaultPetId> into public/default/.
 * Skips when the source is missing but public/default already contains a pet package.
 */
import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(PACKAGE_ROOT, 'public', 'default');

const PET_SKINS_PKG = 'pet-skins';
const DEFAULT_PET_ID = 'sugarwing';

/** Relative to this package: ../pet-skins/<id> */
const DEFAULT_PET_SOURCE = path.join(
  PACKAGE_ROOT,
  '..',
  PET_SKINS_PKG,
  DEFAULT_PET_ID
);

async function hasPetPackage(dirPath) {
  try {
    await access(path.join(dirPath, 'pet.json'));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const DEFAULT_PET_PATH = `../${PET_SKINS_PKG}/${DEFAULT_PET_ID}`;
  const sourceReady = await hasPetPackage(DEFAULT_PET_SOURCE);

  if (!sourceReady) {
    if (await hasPetPackage(PUBLIC)) {
      console.warn(
        `${DEFAULT_PET_PATH} not found; using existing public/default`
      );
      return;
    }

    throw new Error(
      `Default pet package missing. Add ${DEFAULT_PET_PATH} or public/default/pet.json.`
    );
  }

  await rm(PUBLIC, { recursive: true, force: true });
  await mkdir(PUBLIC, { recursive: true });
  await cp(DEFAULT_PET_SOURCE, PUBLIC, { recursive: true });
  console.log(`synced default pet from ${DEFAULT_PET_PATH} -> public/default`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
