import { invoke } from '@tauri-apps/api/core';

export type UserEnv = Record<string, string>;

export type PetTheme = 'light' | 'dark';
export type PetThemeSetting = PetTheme | 'auto';

export const DEFAULT_ANIMATION_TICK_MS = 250;
export const DEFAULT_THEME_SETTING: PetThemeSetting = 'auto';

const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let autoThemeListener: ((event: MediaQueryListEvent) => void) | null = null;

/**
 * Load user env from `~/.ai-pet/.env` via Tauri command.
 * @returns Key-value map (e.g. PET, AI_PET_ANIMATION_TICK).
 */
export async function loadUserEnv(): Promise<UserEnv> {
  return invoke<UserEnv>('load_user_env');
}

/** Read `PET` from user env; empty values are ignored. */
export function envPetId(env: UserEnv): string | undefined {
  const pet = env.PET?.trim();
  return pet || void 0;
}

/** Parse `AI_PET_ANIMATION_TICK`; invalid or missing values fall back to {@link DEFAULT_ANIMATION_TICK_MS}. */
export function envAnimationTickMs(env: UserEnv): number {
  const raw = env.AI_PET_ANIMATION_TICK?.trim();
  if (!raw) {
    return DEFAULT_ANIMATION_TICK_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Invalid AI_PET_ANIMATION_TICK="${raw}", using default ${DEFAULT_ANIMATION_TICK_MS}ms`
    );
    return DEFAULT_ANIMATION_TICK_MS;
  }

  return Math.round(parsed);
}

/** Parse `AI_PET_THEME`; invalid values fall back to {@link DEFAULT_THEME_SETTING}. */
export function envThemeSetting(env: UserEnv): PetThemeSetting {
  const raw = env.AI_PET_THEME?.trim().toLowerCase();
  if (!raw || raw === 'auto') {
    return 'auto';
  }
  if (raw === 'light' || raw === 'dark') {
    return raw;
  }

  console.warn(
    `Invalid AI_PET_THEME="${raw}", using default "${DEFAULT_THEME_SETTING}"`
  );
  return DEFAULT_THEME_SETTING;
}

/** Resolved theme from `prefers-color-scheme`. */
export function systemTheme(): PetTheme {
  return darkSchemeQuery.matches ? 'dark' : 'light';
}

/** Apply resolved theme to `document.documentElement.dataset.theme`. */
export function applyTheme(theme: PetTheme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * Apply theme setting; `auto` listens for system scheme changes.
 * @param setting - `light`, `dark`, or `auto`.
 */
export function applyThemeSetting(setting: PetThemeSetting) {
  if (autoThemeListener) {
    darkSchemeQuery.removeEventListener('change', autoThemeListener);
    autoThemeListener = null;
  }

  if (setting === 'auto') {
    applyTheme(systemTheme());
    autoThemeListener = () => {
      applyTheme(systemTheme());
    };
    darkSchemeQuery.addEventListener('change', autoThemeListener);
    return;
  }

  applyTheme(setting);
}
