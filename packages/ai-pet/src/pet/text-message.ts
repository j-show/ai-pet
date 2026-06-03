/**
 * Shared text bubble message types used by protocol parsing and UI.
 * @module pet/text-message
 */
import type { TextReplyTarget } from './text-source';

/** Icon shown in the bubble header. */
export type TextIcon = 'warn' | 'error' | 'info' | 'loading';

/** Fallback session id when `aipet://text` omits `sid`. */
export const DEFAULT_TEXT_SID = 'default';

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
