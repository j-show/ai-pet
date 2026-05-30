#!/usr/bin/env node
/**
 * Remove only the outer background: flood-fill near-black pixels from image edges.
 * Interior blacks (face screen, ear recesses) stay opaque.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_SOURCE = path.join(__dirname, '../src-tauri/icons/icon-source.png');

/** Treat as background when removing outer fill only. */
const BLACK_CUTOFF = 32;
/** Soft alpha on pixels just outside the solid cat silhouette. */
const BLACK_SOFT = 56;

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function isBackgroundRgb(r, g, b) {
  return Math.max(r, g, b) <= BLACK_CUTOFF;
}

/**
 * @param {PNG} png
 */
function applyOuterTransparentBackground(png) {
  const { width, height, data } = png;
  const size = width * height;
  const outer = new Uint8Array(size);
  /** @type {number[]} */
  const queue = [];

  const tryEnqueue = (x, y) => {
    const i = y * width + x;
    if (outer[i]) {
      return;
    }
    const idx = i << 2;
    if (!isBackgroundRgb(data[idx], data[idx + 1], data[idx + 2])) {
      return;
    }
    outer[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x += 1) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (queue.length > 0) {
    const i = queue.pop();
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) {
      tryEnqueue(x - 1, y);
    }
    if (x < width - 1) {
      tryEnqueue(x + 1, y);
    }
    if (y > 0) {
      tryEnqueue(x, y - 1);
    }
    if (y < height - 1) {
      tryEnqueue(x, y + 1);
    }
  }

  for (let i = 0; i < size; i += 1) {
    if (!outer[i]) {
      continue;
    }
    const idx = i << 2;
    data[idx + 3] = 0;
  }

  // Feather only at the outer background / silhouette boundary.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (outer[i]) {
        continue;
      }

      const idx = i << 2;
      const max = Math.max(data[idx], data[idx + 1], data[idx + 2]);
      if (max > BLACK_SOFT) {
        continue;
      }

      let touchesOuter = false;
      if (x > 0 && outer[i - 1]) {
        touchesOuter = true;
      } else if (x < width - 1 && outer[i + 1]) {
        touchesOuter = true;
      } else if (y > 0 && outer[i - width]) {
        touchesOuter = true;
      } else if (y < height - 1 && outer[i + width]) {
        touchesOuter = true;
      }

      if (!touchesOuter) {
        continue;
      }

      if (max <= BLACK_CUTOFF) {
        continue;
      }

      const alpha = Math.round(
        ((max - BLACK_CUTOFF) / (BLACK_SOFT - BLACK_CUTOFF)) * 255
      );
      data[idx + 3] = Math.min(data[idx + 3], alpha);
    }
  }
}

async function main() {
  const input = process.argv[2] ?? ICON_SOURCE;
  const output = process.argv[3] ?? input;

  const buffer = fs.readFileSync(input);
  const png = PNG.sync.read(buffer);
  applyOuterTransparentBackground(png);
  fs.writeFileSync(output, PNG.sync.write(png));

  console.log(
    `Wrote transparent outer background: ${output} (${png.width}x${png.height})`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
