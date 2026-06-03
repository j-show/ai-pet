import type { TextReplyTarget } from './text-source';

/** Icon shown in the bubble header. */
export type TextIcon = 'warn' | 'error' | 'info' | 'success' | 'loading';

/** Payload for showing or updating one speech bubble. */
export interface AipetTextMessage {
  /** Session id; same sid updates in place, different sids stack vertically. */
  sid: string;
  /** Present when URL includes non-empty `sid` and valid `sty` / `stp`. */
  reply?: TextReplyTarget;
  title?: string;
  text: string;
  icon: TextIcon | null;
}
