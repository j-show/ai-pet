import type { PetAnimation, PetAtlas } from './types';

/** Standard Codex digital pet atlas layout (mochibot / pet_request.json). */
export const CODEX_DEFAULT_ATLAS: PetAtlas = {
  columns: 8,
  cellWidth: 192,
  cellHeight: 208
};

/** Default animation rows for standard Codex pet spritesheets. */
export const CODEX_DEFAULT_ANIMATIONS: PetAnimation[] = [
  { state: 'idle', row: 0, frames: 6, loop: true },
  { state: 'running-right', row: 1, frames: 8, loop: true },
  { state: 'running-left', row: 2, frames: 8, loop: true },
  { state: 'waving', row: 3, frames: 4, loop: false },
  { state: 'jumping', row: 4, frames: 5, loop: false },
  { state: 'failed', row: 5, frames: 8, loop: false },
  { state: 'waiting', row: 6, frames: 6, loop: true },
  { state: 'running', row: 7, frames: 6, loop: true },
  { state: 'review', row: 8, frames: 6, loop: true }
];

export const DEFAULT_PET_ID = 'mochibot';

/** Bundled fallback pet served from `public/default/`. */
export const DEFAULT_PET_BASE = '/default';

export const DEFAULT_CHROMA_KEY = '#FF00FF';
