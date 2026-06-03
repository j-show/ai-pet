import type { TextIcon } from '../pet/text-message';

/** Horizontal center of the pet sprite. */
export const BUBBLE_ANCHOR_X_RATIO = 0.7;

/** Lower-middle area of the pet sprite (feet/belly region). */
export const BUBBLE_ANCHOR_Y_RATIO = 1;

export const BUBBLE_STACK_GAP_PX = 8;

export const TEXT_BUBBLE_ICON_LABELS: Record<
  Exclude<TextIcon, 'loading'>,
  string
> = {
  warn: '!',
  error: '×',
  info: 'i'
};
