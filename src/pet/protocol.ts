import {
  AIPET_KEY_TO_STATE,
  AIPET_SCHEME,
  TEXT_ICON_SET
} from '../constants/protocol';
import { DEFAULT_TEXT_SID } from '../constants/text';

import type { AipetTextMessage, TextIcon } from './text-message';
import { parseTextSource, type TextReplyTarget } from './text-source';
import type { PetState } from './types';

export { AIPET_SCHEME } from '../constants/protocol';

type AipetCommand =
  | { type: 'base' }
  | {
      type: 'animation';
      state: PetState;
      loop: boolean;
      count: number | null;
      defaultMode: boolean;
    };

/** Extract protocol key from `aipet://{key}` (host or pathname, lowercased). */
const parseAipetKey = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith(AIPET_SCHEME)) return null;

    const key = parsed.host || parsed.pathname.replace(/^\//, '');
    return key.toLowerCase() || null;
  } catch {
    //
  }

  return null;
};

const parseLoopParam = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('loop');
    if (raw == null || !raw) return true;

    const value = raw.trim().toLowerCase();

    return !(value === 'false' || value === '0' || value === 'no');
  } catch {
    //
  }

  return true;
};

const parseDefaultParam = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('default');
    if (raw == null || !raw) return false;

    const value = raw.trim().toLowerCase();

    return value === 'true' || value === '1' || value === 'yes';
  } catch {
    //
  }

  return false;
};

const parseCountParam = (url: string): number | null => {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('count');
    if (raw == null || !raw) return null;

    const value = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(value) || value < 1) return null;

    return value;
  } catch {
    //
  }

  return null;
};

/** Parse `aipet://base` or `aipet://{key}?loop=true|false&count=N&default=true`. */
export const parseAipetCommand = (url: string): AipetCommand | null => {
  const key = parseAipetKey(url);
  if (!key || key === 'text') return null;

  if (key === 'base') return { type: 'base' };

  const state = AIPET_KEY_TO_STATE[key];
  if (!state) return null;

  const defaultMode = parseDefaultParam(url);

  return {
    type: 'animation',
    state,
    loop: defaultMode ? true : parseLoopParam(url),
    count: parseCountParam(url),
    defaultMode
  };
};

/** Resolve animation state from URL, or null when not an animation command. */
export const parseAipetState = (url: string): PetState | null => {
  const command = parseAipetCommand(url);
  if (command?.type === 'animation') return command.state;

  return null;
};

const decodeQueryParam = (value: string | null): string => {
  if (value == null || !value) return '';

  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    //
  }

  return value;
};

const parseTextIcon = (raw: string | null): TextIcon | null => {
  const icon = raw?.trim().toLowerCase() ?? '';
  if (!icon) return null;

  if (TEXT_ICON_SET.has(icon as TextIcon)) return icon as TextIcon;

  console.warn(`Unknown aipet text icon: ${icon}`);
  return null;
};

export type AipetTextAction =
  | { type: 'dismiss'; sid?: string }
  | { type: 'show'; message: AipetTextMessage };

const parseTextSid = (raw: string | null): string => {
  const sid = raw?.trim() ?? '';
  return sid || DEFAULT_TEXT_SID;
};

const parseTextReplyTarget = (parsed: URL): TextReplyTarget | undefined => {
  const sid = parsed.searchParams.get('sid')?.trim() ?? '';
  if (!sid) return void 0;

  const sty = parseTextSource(
    parsed.searchParams.get('sty') ?? parsed.searchParams.get('stp')
  );
  if (!sty) return void 0;

  return { sty, sid };
};

/** Parse `aipet://text`, `aipet://text?sid=`, or `aipet://text?sid=&sty=&tl=&icon=&txt=`. */
export const parseAipetTextAction = (url: string): AipetTextAction | null => {
  if (parseAipetKey(url) !== 'text') return null;

  try {
    const parsed = new URL(url);
    const sid = parseTextSid(parsed.searchParams.get('sid'));
    const title = decodeQueryParam(parsed.searchParams.get('tl'));
    const text = decodeQueryParam(parsed.searchParams.get('txt'));
    const iconParam = parsed.searchParams.get('icon');

    if (parsed.search.length <= 1) return { type: 'dismiss' };

    if (!title && !text && !iconParam) {
      return parsed.searchParams.has('sid')
        ? { type: 'dismiss', sid }
        : { type: 'dismiss' };
    }

    return {
      type: 'show',
      message: {
        sid,
        reply: parseTextReplyTarget(parsed),
        title: title || void 0,
        icon: parseTextIcon(iconParam),
        text
      }
    };
  } catch {
    //
  }

  return null;
};

/** Convenience wrapper: returns show-message payload only (not dismiss). */
export const parseAipetText = (url: string): AipetTextMessage | null => {
  const action = parseAipetTextAction(url);
  if (action?.type === 'show') return action.message;

  return null;
};
