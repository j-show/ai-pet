#!/usr/bin/env node
/**
 * Open an aipet:// URL.
 * - During `pnpm pet:dev`, forwards to the Vite dev bridge on :1420
 * - Otherwise uses the OS handler (`open` / `start` / `xdg-open`); the running
 *   app keeps a single instance via tauri-plugin-single-instance + deep-link.
 */
import { spawnSync } from 'node:child_process';

const DEV_PROTOCOL_PATH = '/__aipet/protocol';
const DEV_SERVER = 'http://localhost:1420';

const url = process.argv[2];
if (!url?.startsWith('aipet://')) {
  console.error('Usage: node scripts/aipet-open.mjs aipet://<key>[?query]');
  process.exit(1);
}

const sendToDevServer = async () => {
  const response = await fetch(`${DEV_SERVER}${DEV_PROTOCOL_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!response.ok) {
    throw new Error(`dev bridge responded ${response.status}`);
  }
};

const openWithSystem = () => {
  const platform = process.platform;
  let result;

  if (platform === 'win32') {
    result = spawnSync('rundll32', ['url.dll,FileProtocolHandler', url], {
      encoding: 'utf8',
      shell: false
    });
  } else if (platform === 'darwin') {
    result = spawnSync('open', [url], { encoding: 'utf8' });
  } else {
    result = spawnSync('xdg-open', [url], { encoding: 'utf8' });
  }

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || result.stdout?.trim() || 'system open failed'
    );
  }
};

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
