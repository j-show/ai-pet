import { invoke } from '@tauri-apps/api/core';

import {
  DEFAULT_ANIMATION_TICK_MS,
  DEFAULT_THEME_SETTING as DEFAULT_THEME_SETTING_VALUE
} from '../constants/env';

export type PetTheme = 'light' | 'dark';
export type PetThemeSetting = PetTheme | 'auto';

/** Boolean flags in `.env` (`true` / `1` / `yes` / `on`, etc.). */
export type UserEnvBoolean =
  | 'true'
  | 'false'
  | '1'
  | '0'
  | 'yes'
  | 'no'
  | 'on'
  | 'off';

/** `AI_PET_THEME` — resolved by {@link envThemeSetting}. */
export type UserEnvTheme = PetThemeSetting;

/** Frame interval in ms, e.g. `"250"`. Parsed by {@link envAnimationTickMs}. */
export type UserEnvAnimationTick = `${number}`;

/** Display scale in `0.5`–`2.0`, e.g. `"1"`. Parsed by {@link envPetScale}. */
export type UserEnvPetScale = string;

/** Screen coordinate in pixels, e.g. `"1920"`. Parsed by {@link parseWindowAnchor}. */
export type UserEnvWindowCoord = string;

/**
 * Known keys in `~/.ai-pet/.env`.
 * Values are stored as strings; use `env*` helpers for typed runtime values.
 */
export interface UserEnv {
  /** Default pet id (`~/.ai-pet/pets/<id>`). */
  PET?: string;
  AI_PET_ANIMATION_TICK?: UserEnvAnimationTick;
  AI_PET_DEBUG_PROTOCOL?: UserEnvBoolean;
  AI_PET_THEME?: UserEnvTheme;
  AI_PET_SCALE?: UserEnvPetScale;
  /** Top-right anchor X (screen space). */
  AI_PET_WINDOW_RIGHT?: UserEnvWindowCoord;
  /** Top edge Y (screen space). */
  AI_PET_WINDOW_TOP?: UserEnvWindowCoord;
  /** Optional `qcode` reply shell command (read in Rust). Placeholders: `{sid}`, `{inbox}`. */
  AI_PET_REPLY_QCODE_CMD?: string;
}

/** Partial {@link UserEnv} passed to Tauri `save_user_env` (merges into `~/.ai-pet/.env`). */
export type UserEnvUpdate = Partial<UserEnv>;

export { DEFAULT_ANIMATION_TICK_MS } from '../constants/env';

export const DEFAULT_THEME_SETTING: PetThemeSetting =
  DEFAULT_THEME_SETTING_VALUE as PetThemeSetting;

const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let autoThemeListener: ((event: MediaQueryListEvent) => void) | null = null;

/**
 * Load user env from `~/.ai-pet/.env` via Tauri command.
 */
export const loadUserEnv = async (): Promise<UserEnv> => {
  const raw = await invoke<Record<string, string>>('load_user_env');
  return raw as UserEnv;
};

/** Merge keys into `~/.ai-pet/.env` (replaces existing keys). */
export const saveUserEnv = async (values: UserEnvUpdate): Promise<void> => {
  return invoke('save_user_env', {
    values: values as Record<string, string>
  });
};

/** Read `PET` from user env; empty values are ignored. */
export const envPetId = (env: UserEnv): string | undefined => {
  const pet = env.PET?.trim();
  return pet || void 0;
};

/** Parse `AI_PET_ANIMATION_TICK`; invalid or missing values fall back to {@link DEFAULT_ANIMATION_TICK_MS}. */
export const envAnimationTickMs = (env: UserEnv): number => {
  const raw = env.AI_PET_ANIMATION_TICK?.trim();
  if (!raw) return DEFAULT_ANIMATION_TICK_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Invalid AI_PET_ANIMATION_TICK="${raw}", using default ${DEFAULT_ANIMATION_TICK_MS}ms`
    );
    return DEFAULT_ANIMATION_TICK_MS;
  }

  return Math.round(parsed);
};

/** Parse `AI_PET_DEBUG_PROTOCOL`; logs aipet:// traffic when true. */
export const envProtocolDebug = (env: UserEnv): boolean => {
  const raw = env.AI_PET_DEBUG_PROTOCOL?.trim().toLowerCase();
  if (!raw) return false;

  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

/** Parse `AI_PET_THEME`; invalid values fall back to {@link DEFAULT_THEME_SETTING}. */
export const envThemeSetting = (env: UserEnv): PetThemeSetting => {
  const raw = env.AI_PET_THEME?.trim().toLowerCase();
  if (!raw || raw === 'auto') return 'auto';

  if (raw === 'light' || raw === 'dark') return raw;

  console.warn(
    `Invalid AI_PET_THEME="${raw}", using default "${DEFAULT_THEME_SETTING}"`
  );

  return DEFAULT_THEME_SETTING;
};

/** Resolved theme from `prefers-color-scheme`. */
export const systemTheme = (): PetTheme =>
  darkSchemeQuery.matches ? 'dark' : 'light';

/** Apply resolved theme to `document.documentElement.dataset.theme`. */
export const applyTheme = (theme: PetTheme) => {
  document.documentElement.dataset.theme = theme;
};

/**
 * Apply theme setting; `auto` listens for system scheme changes.
 * @param setting - `light`, `dark`, or `auto`.
 */
export const applyThemeSetting = (setting: PetThemeSetting) => {
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
};
