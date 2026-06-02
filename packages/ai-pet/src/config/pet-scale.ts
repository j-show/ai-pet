import { saveUserEnv, type UserEnv } from './user-env';

export const ENV_PET_SCALE = 'AI_PET_SCALE';
export const DEFAULT_PET_SCALE = 1;
export const MIN_PET_SCALE = 0.5;
export const MAX_PET_SCALE = 2;

/** Clamp scale to allowed range. */
export const clampPetScale = (value: number): number =>
  Math.min(MAX_PET_SCALE, Math.max(MIN_PET_SCALE, value));

/** Read `AI_PET_SCALE` from user env; invalid values fall back to {@link DEFAULT_PET_SCALE}. */
export const envPetScale = (env: UserEnv): number => {
  const raw = env[ENV_PET_SCALE]?.trim();
  if (!raw) return DEFAULT_PET_SCALE;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Invalid ${ENV_PET_SCALE}="${raw}", using default ${DEFAULT_PET_SCALE}`
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
    [ENV_PET_SCALE]: formatPetScale(scale)
  });
};
