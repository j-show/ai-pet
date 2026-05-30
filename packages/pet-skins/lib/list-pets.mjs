import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

const SKIP_DIRS = new Set(['scripts', 'node_modules', 'lib', 'test']);

/**
 * @param {string} dirPath
 * @returns {Promise<boolean>}
 */
export async function hasPetPackage(dirPath) {
  try {
    await access(path.join(dirPath, 'pet.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * List deployable pet directories under the pet-skins package root.
 * @param {string} packageRoot - Absolute path to `packages/pet-skins`.
 * @returns {Promise<Array<{ name: string, sourceAbs: string }>>}
 */
export async function listDeployablePets(packageRoot) {
  const entries = await readdir(packageRoot, { withFileTypes: true });
  const names = entries
    .filter(entry => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const pets = [];
  for (const name of names) {
    const sourceAbs = path.resolve(packageRoot, name);
    if (await hasPetPackage(sourceAbs)) {
      pets.push({ name, sourceAbs });
    }
  }

  return pets;
}
