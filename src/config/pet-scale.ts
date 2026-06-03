import {
  DEFAULT_PET_SCALE,
  DEFAULT_MAX_PET_SCALE,
  DEFAULT_MIN_PET_SCALE
} from '../constants/env';

import { saveUserEnv, type UserEnv } from './user-env';

export {
  DEFAULT_MAX_PET_SCALE,
  DEFAULT_MIN_PET_SCALE,
  DEFAULT_PET_SCALE
} from '../constants/env';

/**
 * Clamp scale to {@link DEFAULT_MIN_PET_SCALE}–{@link DEFAULT_MAX_PET_SCALE}.
 * @param value - Raw scale factor.
 */
export const clampPetScale = (value: number): number =>
  Math.min(DEFAULT_MAX_PET_SCALE, Math.max(DEFAULT_MIN_PET_SCALE, value));

/** Read `AI_PET_SCALE` from user env; invalid values fall back to {@link DEFAULT_PET_SCALE}. */
export const envPetScale = (env: UserEnv): number => {
  const raw = env.AI_PET_SCALE?.trim();
  if (!raw) return DEFAULT_PET_SCALE;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Invalid AI_PET_SCALE="${raw}", using default ${DEFAULT_PET_SCALE}`
    );
    return DEFAULT_PET_SCALE;
  }

  return clampPetScale(parsed);
};

/** Format scale for `~/.ai-pet/.env` (two decimal places). */
export const formatPetScale = (scale: number): string => {
  const rounded = Math.round(clampPetScale(scale) * 100) / 100;
  return String(rounded);
};

/** Persist pet display scale to `~/.ai-pet/.env`. */
export const savePetScale = async (scale: number): Promise<void> => {
  await saveUserEnv({
    AI_PET_SCALE: formatPetScale(scale)
  });
};
