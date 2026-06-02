#!/usr/bin/env node
/**
 * Interactive deploy: pick a pet-skins package, toggle install in ~/.ai-pet/pets.
 * Installs by copying packages/pet-skins/<petId>/ into ~/.ai-pet/pets/<petId>/.
 */
import {
  access,
  cp,
  lstat,
  mkdir,
  rm,
  unlink,
  readdir
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** pet-skins package root (parent of scripts/). */
const PACKAGE_ROOT = path.resolve(__dirname, '..');
/** AI Pet user pets directory; deploy copies packages here. */
const PETS_DIR = path.join(os.homedir(), '.ai-pet', 'pets');

const SKIP_DIRS = new Set(['scripts', 'node_modules', 'lib', 'test']);

/**
 * List deployable pet directories under the pet-skins package root.
 * @param {string} packageRoot - Absolute path to `packages/pet-skins`.
 * @returns {Promise<Array<{ name: string, sourceAbs: string }>>}
 */
const listDeployablePets = async packageRoot => {
  const entries = await readdir(packageRoot, { withFileTypes: true });
  const names = entries
    .filter(entry => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const pets = [];
  for (const name of names) {
    const sourceAbs = path.resolve(packageRoot, name);
    const sourcePet = path.join(sourceAbs, 'pet.json');
    if (await access(sourcePet)) {
      pets.push({ name, sourceAbs });
    }
  }

  return pets;
};

/**
 * @param {string} name Pet directory name.
 * @returns {Promise<void>}
 */
const uninstallPet = async name => {
  const linkPath = path.join(PETS_DIR, name);
  const stat = await lstat(linkPath);
  if (stat.isSymbolicLink()) {
    await unlink(linkPath);
  } else {
    await rm(linkPath, { recursive: true, force: true });
  }
};

/**
 * @param {string} name Pet directory name.
 * @param {string} sourceAbs Absolute path to the source package.
 * @returns {Promise<void>}
 */
const installPet = async (name, sourceAbs) => {
  const targetPath = path.join(PETS_DIR, name);
  await uninstallPet(name).catch(() => {});
  await cp(sourceAbs, targetPath, { recursive: true, force: true });
};

/**
 * @returns {Promise<PetEntry[]>}
 */
const loadPets = async () => {
  const deployable = await listDeployablePets(PACKAGE_ROOT);
  return Promise.all(
    deployable.map(async ({ name, sourceAbs }) => ({
      name,
      sourceAbs,
      installed: await access(path.join(PETS_DIR, name))
    }))
  );
};

/**
 * @param {PetEntry[]} pets
 * @returns {Promise<void>}
 */
const runSelector = pets => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('deploy requires an interactive terminal (TTY)');
  }

  return new Promise(resolve => {
    let selected = 0;
    let statusLine = '';
    let paintedLines = 0;
    let busy = false;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKeypress);
      if (paintedLines > 0) {
        readline.moveCursor(process.stdout, 0, -paintedLines);
        readline.clearScreenDown(process.stdout);
      }
      readline.cursorTo(process.stdout, 0, 0);
    };

    const paint = () => {
      const lines = [
        'pet-skins deploy',
        '↑/↓ select   Enter install/uninstall   Ctrl+C quit',
        '',
        ...pets.map((pet, i) => {
          const cursor = i === selected ? '>' : ' ';
          const mark = pet.installed ? '*' : ' ';
          return `${cursor} ${mark} ${pet.name}`;
        })
      ];
      if (statusLine) {
        lines.push('', statusLine);
      }

      if (paintedLines > 0) {
        readline.moveCursor(process.stdout, 0, -paintedLines);
        readline.clearScreenDown(process.stdout);
      }
      process.stdout.write(`${lines.join('\n')}\n`);
      paintedLines = lines.length;
    };

    /** @param {string | undefined} _str @param {readline.Key} key */
    const onKeypress = async (_str, key) => {
      if (!key || busy) {
        return;
      }

      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\n');
        resolve();
        return;
      }

      if (key.name === 'up' || key.name === 'k') {
        selected = selected > 0 ? selected - 1 : pets.length - 1;
        paint();
        return;
      }

      if (key.name === 'down' || key.name === 'j') {
        selected = selected < pets.length - 1 ? selected + 1 : 0;
        paint();
        return;
      }

      if (key.name !== 'return') {
        return;
      }

      const pet = pets[selected];
      busy = true;
      try {
        if (pet.installed) {
          await uninstallPet(pet.name);
          pet.installed = false;
          statusLine = `removed ${pet.name}`;
        } else {
          await installPet(pet.name, pet.sourceAbs);
          pet.installed = true;
          statusLine = `copied ${pet.name} <- ${pet.sourceAbs}`;
        }
      } catch (err) {
        statusLine = err instanceof Error ? err.message : 'toggle failed';
      }
      busy = false;
      paint();
    };

    process.stdin.on('keypress', onKeypress);
    paint();
  });
};

const main = async () => {
  await mkdir(PETS_DIR, { recursive: true });

  const pets = await loadPets();
  if (pets.length === 0) {
    console.error(`no pet packages found under ${PACKAGE_ROOT}`);
    process.exit(1);
  }

  await runSelector(pets);
};

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
