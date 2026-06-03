#!/usr/bin/env node
/** Remove build artifacts that may embed stale absolute paths. */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

for (const rel of ['dist', 'src-tauri/target', 'src-tauri/gen']) {
  const target = path.join(packageRoot, rel);
  rmSync(target, { recursive: true, force: true });
  console.log(`removed ${rel}/`);
}
