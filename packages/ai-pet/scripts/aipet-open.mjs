#!/usr/bin/env node
/**
 * Open an aipet:// URL.
 * - During `pnpm pet:dev`, forwards to the Vite dev bridge on :1420
 * - Otherwise uses the OS handler (`open` / `start` / `xdg-open`)
 */
import { spawnSync } from 'node:child_process';

const DEV_PROTOCOL_PATH = '/__aipet/protocol';
const DEV_SERVER = 'http://localhost:1420';

const url = process.argv[2];
if (!url?.startsWith('aipet://')) {
  console.error('Usage: node scripts/aipet-open.mjs aipet://<key>[?query]');
  process.exit(1);
}

async function sendToDevServer() {
  const endpoint = `${DEV_SERVER}${DEV_PROTOCOL_PATH}?url=${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`dev bridge responded ${response.status}`);
  }
}

function openWithSystem() {
  const platform = process.platform;
  let result;

  if (platform === 'win32') {
    result = spawnSync('cmd', ['/c', 'start', '', url], {
      encoding: 'utf8',
      shell: false
    });
  } else if (platform === 'darwin') {
    result = spawnSync('open', [url], { encoding: 'utf8' });
  } else {
    result = spawnSync('xdg-open', [url], { encoding: 'utf8' });
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message =
      result.stderr?.trim() || result.stdout?.trim() || 'system open failed';
    throw new Error(message);
  }
}

try {
  await sendToDevServer();
  console.log(`sent to dev app: ${url}`);
} catch (devError) {
  try {
    await openWithSystem();
    console.log(`opened via system: ${url}`);
  } catch (systemError) {
    console.error(`Failed to open ${url}`);
    console.error(
      `  dev bridge: ${devError instanceof Error ? devError.message : devError}`
    );
    console.error(
      `  system open: ${systemError instanceof Error ? systemError.message : systemError}`
    );
    console.error('');
    console.error('Tips:');
    console.error('  1. Run `pnpm pet:dev`, then retry this command');
    console.error(
      '  2. Or run `pnpm pet:build`, open AI Pet.app once, then retry'
    );
    process.exit(1);
  }
}
