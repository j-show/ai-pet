#!/usr/bin/env node
/**
 * Interactive deploy: pick a pet-skins package, toggle install in ~/.codex/pets.
 * Installs by copying packages/pet-skins/<petId>/ into ~/.codex/pets/<petId>/.
 */
import { access, cp, lstat, mkdir, rm, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { listDeployablePets } from '../lib/list-pets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** pet-skins package root (parent of scripts/). */
const PACKAGE_ROOT = path.resolve(__dirname, '..');
/** Codex user pets directory; deploy copies packages here. */
const PETS_DIR = path.join(os.homedir(), '.codex', 'pets');

/**
 * One deployable pet under pet-skins/.
 * @typedef {object} PetEntry
 * @property {string} name Directory name (pet id).
 * @property {string} sourceAbs Absolute path to the package directory.
 * @property {boolean} installed Whether ~/.codex/pets/<name> already exists.
 */

/**
 * @param {string} name Pet directory name.
 * @returns {Promise<boolean>}
 */
async function isInstalled(name) {
  try {
    await access(path.join(PETS_DIR, name));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} name Pet directory name.
 * @returns {Promise<void>}
 */
async function uninstallPet(name) {
  const linkPath = path.join(PETS_DIR, name);
  const stat = await lstat(linkPath);
  if (stat.isSymbolicLink()) {
    await unlink(linkPath);
  } else {
    await rm(linkPath, { recursive: true, force: true });
  }
}

/**
 * @param {string} name Pet directory name.
 * @param {string} sourceAbs Absolute path to the source package.
 * @returns {Promise<void>}
 */
async function installPet(name, sourceAbs) {
  const targetPath = path.join(PETS_DIR, name);
  await uninstallPet(name).catch(() => {});
  await cp(sourceAbs, targetPath, { recursive: true, force: true });
}

/**
 * @returns {Promise<PetEntry[]>}
 */
async function loadPets() {
  const deployable = await listDeployablePets(PACKAGE_ROOT);
  return Promise.all(
    deployable.map(async ({ name, sourceAbs }) => ({
      name,
      sourceAbs,
      installed: await isInstalled(name)
    }))
  );
}

/**
 * @param {PetEntry[]} pets
 * @returns {Promise<void>}
 */
function runSelector(pets) {
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
}

async function main() {
  await mkdir(PETS_DIR, { recursive: true });

  const pets = await loadPets();
  if (pets.length === 0) {
    console.error(`no pet packages found under ${PACKAGE_ROOT}`);
    process.exit(1);
  }

  await runSelector(pets);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
