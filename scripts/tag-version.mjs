#!/usr/bin/env node
/**
 * Interactive semver bump for this package, then sync Cargo/Tauri via sync-version.
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = path.join(PACKAGE_ROOT, 'package.json');
const REPO_ROOT = PACKAGE_ROOT;

const BUMP_OPTIONS = [
  { key: 'major', label: 'major' },
  { key: 'minor', label: 'minor' },
  { key: 'patch', label: 'patch' }
];

const DEFAULT_BUMP = 'patch';

/** @type {boolean} */
const noGit = process.argv.includes('--no-git');

/**
 * @param {string} version
 * @returns {[number, number, number]}
 */
const parseVersion = version => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    throw new Error(`invalid semver (expected major.minor.patch): ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
 */
const compareVersion = (a, b) => {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
};

/**
 * @param {string[]} versions
 * @returns {string}
 */
const maxVersion = versions =>
  versions.reduce((best, current) =>
    compareVersion(current, best) > 0 ? current : best
  );

/**
 * @param {string} version
 * @param {'major' | 'minor' | 'patch'} kind
 * @returns {string}
 */
const bumpVersion = (version, kind) => {
  const [major, minor, patch] = parseVersion(version);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

/**
 * @returns {Promise<string>}
 */
const readPackageVersion = async () => {
  const raw = await readFile(PACKAGE_JSON, 'utf8');
  const pkg = JSON.parse(raw);
  const version = pkg?.version;
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error(`invalid version in ${PACKAGE_JSON}`);
  }
  parseVersion(version);
  return version;
};

/**
 * Latest git tag matching v{semver}, or null if none.
 * @returns {string | null}
 */
const readLatestTagVersion = () => {
  const result = spawnSync(
    'git',
    ['tag', '-l', 'v*', '--sort=-version:refname'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || 'git tag failed (is this a git repository?)'
    );
  }
  const tag = result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);
  if (!tag) return null;

  const match = /^v(\d+\.\d+\.\d+)$/.exec(tag);
  if (!match) {
    throw new Error(`latest tag has unexpected format: ${tag}`);
  }
  return match[1];
};

/**
 * @param {string} nextVersion
 * @returns {Promise<void>}
 */
const writePackageVersion = async (fn, ver) => {
  const raw = await readFile(fn, 'utf8');
  const pkg = JSON.parse(raw);
  pkg.version = ver;
  await writeFile(fn, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  console.log(`Updated ${path.relative(REPO_ROOT, fn)} → ${ver}`);
};

/**
 * @param {readline.Interface} rl
 * @returns {Promise<'major' | 'minor' | 'patch'>}
 */
const promptBumpKind = async rl => {
  console.log('\nSelect bump type (↑/↓, Enter confirms):');
  let selected = BUMP_OPTIONS.findIndex(o => o.key === DEFAULT_BUMP);

  const render = () => {
    for (const [index, option] of BUMP_OPTIONS.entries()) {
      const marker = index === selected ? '>' : ' ';
      const suffix = option.key === DEFAULT_BUMP ? ' (default)' : '';
      console.log(`  ${marker} ${option.label}${suffix}`);
    }
  };

  render();

  if (!input.isTTY) {
    return DEFAULT_BUMP;
  }

  readline.emitKeypressEvents(input);
  if (input.isTTY) {
    input.setRawMode(true);
    input.resume();
  }

  return new Promise((resolve, reject) => {
    /** @param {string | undefined} _str @param {readline.Key} key */
    const onKeypress = (_str, key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('cancelled'));
        return;
      }
      if (key.name === 'up') {
        selected = (selected - 1 + BUMP_OPTIONS.length) % BUMP_OPTIONS.length;
        readline.moveCursor(output, 0, -BUMP_OPTIONS.length);
        render();
        return;
      }
      if (key.name === 'down') {
        selected = (selected + 1) % BUMP_OPTIONS.length;
        readline.moveCursor(output, 0, -BUMP_OPTIONS.length);
        render();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        console.log('');
        resolve(
          /** @type {'major' | 'minor' | 'patch'} */ (
            BUMP_OPTIONS[selected].key
          )
        );
      }
    };

    const cleanup = () => {
      input.removeListener('keypress', onKeypress);
      if (input.isTTY) input.setRawMode(false);
    };

    input.on('keypress', onKeypress);
  });
};

/**
 * @param {readline.Interface} rl
 * @param {string} message
 * @returns {Promise<boolean>}
 */
const confirm = async (rl, message) => {
  const answer = await rl.question(`${message} [Y/n]: `);
  const normalized = answer.trim().toLowerCase();
  if (normalized === '' || normalized === 'y' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'n' || normalized === 'no') {
    return false;
  }
  console.log('Please answer Y or n.');
  return confirm(rl, message);
};

const main = async () => {
  if (!input.isTTY || !output.isTTY) {
    throw new Error('tag-version requires an interactive terminal (TTY)');
  }

  const v1 = await readPackageVersion();
  const v2 = readLatestTagVersion();
  const ver = v2 === null ? v1 : maxVersion([v1, v2]);

  console.log(`Current version: ${ver}`);

  const rl = createInterface({ input, output });
  try {
    const kind = await promptBumpKind(rl);
    const next = bumpVersion(ver, kind);

    console.log(`\nNext version: ${next} (${kind})`);
    const ok = await confirm(rl, 'Apply this version?');
    if (!ok) {
      console.log('Cancelled.');
      return;
    }

    await writePackageVersion(PACKAGE_JSON, next);

    console.log('\nRunning pnpm sync:version …');
    let result = spawnSync('pnpm', ['sync:version'], {
      cwd: PACKAGE_ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }

    if (!noGit) {
      const tag = `v${next}`;
      result = spawnSync('git', ['tag', tag], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      if (result.status !== 0) {
        console.error(`git tag failed with status ${result.status}`);
        process.exit(result.status ?? 1);
      } else {
        console.log(`Tagged commit with ${tag}`);
      }

      // 推送新打的 tag 到 origin
      result = spawnSync('git', ['push', 'origin', tag], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });
      if (result.status !== 0) {
        console.error(
          `git push origin ${tag} failed with status ${result.status}`
        );
        process.exit(result.status ?? 1);
      } else {
        console.log(`Pushed tag ${tag} to origin`);
      }
    }
  } finally {
    rl.close();
  }
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
