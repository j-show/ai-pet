import type { PetState } from '../pet/types';

/** Minimum pointer movement before drag-run animation starts. */
export const DRAG_THRESHOLD_PX = 6;

/** Opposite movement required before flipping run direction during drag loop. */
export const DIRECTION_FLIP_PX = 10;

export const TAP_MAX_MS = 350;

export const IDLE_BEHAVIOR_MIN_MS = 25_000;
export const IDLE_BEHAVIOR_MAX_MS = 55_000;
export const IDLE_BEHAVIOR_STATES: PetState[] = ['jumping'];

export const HOVER_JUMP_CYCLES = 3;

/** 1-based frames 1-2 → 0-based 0-1 */
export const DRAG_START_FROM = 0;
export const DRAG_START_TO = 1;

/** 1-based frames 3-6 → 0-based 2-5 */
export const DRAG_LOOP_FROM = 2;
export const DRAG_LOOP_TO = 5;

/** 1-based frames 7-8 → 0-based 6-7 */
export const DRAG_END_FROM = 6;
export const DRAG_END_TO = 7;
