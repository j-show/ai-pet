#!/usr/bin/env node
/**
 * Interactive deploy: pick a dist/ pet, toggle install in ~/.codex/pets.
 * Installs by copying dist/<pet> into ~/.codex/pets/<pet>.
 */
import {
  access,
  cp,
  lstat,
  mkdir,
  readdir,
  rm,
  unlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repository root (parent of scripts/). */
const ROOT = path.resolve(__dirname, "..");
/** Built pet packages, one subdirectory per pet id. */
const DIST = path.join(ROOT, "dist");
/** Codex user pets directory; deploy creates links here. */
const PETS_DIR = path.join(os.homedir(), ".codex", "pets");

/**
 * One deployable pet under dist/.
 * @typedef {object} PetEntry
 * @property {string} name Directory name under dist/ (pet id).
 * @property {string} sourceAbs Absolute path to the dist/<name> package.
 * @property {boolean} installed Whether ~/.codex/pets/<name> already exists.
 */

/**
 * Returns whether a link or directory already exists at ~/.codex/pets/<name>.
 * @param {string} name Pet directory name under dist/.
 * @returns {Promise<boolean>} True when the pets path is accessible.
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
 * Copies dist/<name> into ~/.codex/pets/<name>.
 * @param {string} name Pet directory name.
 * @param {string} sourceAbs Absolute path to dist/<name>.
 * @returns {Promise<void>}
 * @throws {Error} When copy fails.
 */
async function installPet(name, sourceAbs) {
  const targetPath = path.join(PETS_DIR, name);
  // Ensure a clean install. This also handles any legacy symlink/junction installs.
  await uninstallPet(name).catch(() => {});
  await cp(sourceAbs, targetPath, { recursive: true, force: true });
}

/**
 * Removes ~/.codex/pets/<name> without deleting the dist source.
 * @param {string} name Pet directory name.
 * @returns {Promise<void>}
 * @throws {Error} When the path is missing or removal fails.
 */
async function uninstallPet(name) {
  const linkPath = path.join(PETS_DIR, name);
  const stat = await lstat(linkPath);
  if (stat.isSymbolicLink()) {
    await unlink(linkPath);
  } else {
    // Copied or real directories are removed recursively; symlinks use unlink only.
    await rm(linkPath, { recursive: true, force: true });
  }
}

/**
 * Lists dist/ subdirectories and whether each is installed under ~/.codex/pets.
 * @returns {Promise<PetEntry[]>} Sorted by pet name.
 */
async function loadPets() {
  const entries = await readdir(DIST, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    dirs.map(async (name) => ({
      name,
      sourceAbs: path.resolve(DIST, name),
      installed: await isInstalled(name),
    })),
  );
}

/**
 * Full-screen TUI: arrow keys move selection, Enter toggles install/uninstall.
 * @param {PetEntry[]} pets Pets from loadPets(); installed flags are mutated in place.
 * @returns {Promise<void>} Resolves on Ctrl+C after restoring the terminal.
 * @throws {Error} When stdin/stdout is not a TTY.
 */
function runSelector(pets) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("deploy requires an interactive terminal (TTY)");
  }

  return new Promise((resolve) => {
    let selected = 0;
    let statusLine = "";
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
      process.stdin.removeListener("keypress", onKeypress);
      if (paintedLines > 0) {
        readline.moveCursor(process.stdout, 0, -paintedLines);
        readline.clearScreenDown(process.stdout);
      }
      readline.cursorTo(process.stdout, 0, 0);
    };

    const paint = () => {
      const lines = [
        "codex-pets deploy",
        "↑/↓ select   Enter install/uninstall   Ctrl+C quit",
        "",
        ...pets.map((pet, i) => {
          const cursor = i === selected ? ">" : " ";
          const mark = pet.installed ? "*" : " ";
          return `${cursor} ${mark} ${pet.name}`;
        }),
      ];
      if (statusLine) {
        lines.push("", statusLine);
      }

      if (paintedLines > 0) {
        readline.moveCursor(process.stdout, 0, -paintedLines);
        readline.clearScreenDown(process.stdout);
      }
      process.stdout.write(`${lines.join("\n")}\n`);
      paintedLines = lines.length;
    };

    /** @param {string | undefined} str @param {readline.Key} key */
    const onKeypress = async (str, key) => {
      // Drop input while install/remove is in progress to avoid overlapping toggles.
      if (!key || busy) {
        return;
      }

      if (key.ctrl && key.name === "c") {
        cleanup();
        process.stdout.write("\n");
        resolve();
        return;
      }

      if (key.name === "up" || key.name === "k") {
        selected = selected > 0 ? selected - 1 : pets.length - 1;
        paint();
        return;
      }

      if (key.name === "down" || key.name === "j") {
        selected = selected < pets.length - 1 ? selected + 1 : 0;
        paint();
        return;
      }

      if (key.name !== "return") {
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
        statusLine =
          err instanceof Error ? err.message : "toggle failed";
      }
      busy = false;
      paint();
    };

    process.stdin.on("keypress", onKeypress);
    paint();
  });
}

/**
 * Ensures ~/.codex/pets exists, validates dist/, then runs the selector.
 * Exits with code 1 when dist is missing or an unhandled error occurs.
 * @returns {Promise<void>}
 */
async function main() {
  await mkdir(PETS_DIR, { recursive: true });

  try {
    await access(DIST);
  } catch {
    console.error(`dist not found: ${DIST}`);
    process.exit(1);
  }

  const pets = await loadPets();
  if (pets.length === 0) {
    console.warn(`no directories under ${DIST}`);
    return;
  }

  await runSelector(pets);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
