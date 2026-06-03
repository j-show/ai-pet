import type { TextIcon } from '../pet/text-message';
import type { PetState } from '../pet/types';

export const AIPET_SCHEME = 'aipet:';

export const TEXT_ICON_VALUES: readonly TextIcon[] = [
  'warn',
  'error',
  'info',
  'success',
  'loading'
];

export const TEXT_ICON_SET = new Set<TextIcon>(TEXT_ICON_VALUES);

/** Protocol key → spritesheet animation state (excluding `base`). */
export const AIPET_KEY_TO_STATE: Record<string, PetState> = {
  waving: 'waving',
  jumping: 'jumping',
  failed: 'failed',
  waiting: 'waiting',
  running: 'running',
  runing: 'running',
  review: 'review'
};
