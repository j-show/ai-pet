import type { AipetTextMessage, TextIcon } from './text-bubble';
import type { PetState } from './types';

export const AIPET_SCHEME = 'aipet';

const TEXT_ICON_VALUES = new Set<TextIcon>(['warn', 'error', 'info']);

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

export type AipetCommand =
  | { type: 'base' }
  | {
      type: 'animation';
      state: PetState;
      loop: boolean;
      count: number | null;
      defaultMode: boolean;
    };

/** Extract protocol key from `aipet://{key}` (host or pathname, lowercased). */
export function parseAipetKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${AIPET_SCHEME}:`) {
      return null;
    }

    const key = (
      parsed.host || parsed.pathname.replace(/^\//, '')
    ).toLowerCase();
    return key || null;
  } catch {
    return null;
  }
}

function parseLoopParam(url: string): boolean {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('loop');
    if (raw === null || raw === '') {
      return true;
    }

    const value = raw.trim().toLowerCase();
    if (value === 'false' || value === '0' || value === 'no') {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

function parseDefaultParam(url: string): boolean {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('default');
    if (raw === null || raw === '') {
      return false;
    }

    const value = raw.trim().toLowerCase();
    return value === 'true' || value === '1' || value === 'yes';
  } catch {
    return false;
  }
}

function parseCountParam(url: string): number | null {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get('count');
    if (raw === null || raw === '') {
      return null;
    }

    const value = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(value) || value < 1) {
      console.warn(`Invalid aipet count: ${raw}`);
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

/** Parse `aipet://base` or `aipet://{key}?loop=true|false&count=N&default=true`. */
export function parseAipetCommand(url: string): AipetCommand | null {
  const key = parseAipetKey(url);
  if (!key || key === 'text') {
    return null;
  }

  if (key === 'base') {
    return { type: 'base' };
  }

  const state = AIPET_KEY_TO_STATE[key];
  if (!state) {
    return null;
  }

  const defaultMode = parseDefaultParam(url);

  return {
    type: 'animation',
    state,
    loop: defaultMode ? true : parseLoopParam(url),
    count: parseCountParam(url),
    defaultMode
  };
}

/** Resolve animation state from URL, or null when not an animation command. */
export function parseAipetState(url: string): PetState | null {
  const command = parseAipetCommand(url);
  if (command?.type === 'animation') {
    return command.state;
  }
  return null;
}

function decodeQueryParam(value: string | null): string {
  if (value === null || value === '') {
    return '';
  }

  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseTextIcon(raw: string | null): TextIcon | null {
  const icon = raw?.trim().toLowerCase() ?? '';
  if (!icon) {
    return null;
  }
  if (TEXT_ICON_VALUES.has(icon as TextIcon)) {
    return icon as TextIcon;
  }
  console.warn(`Unknown aipet text icon: ${icon}`);
  return null;
}

export type AipetTextAction =
  | { type: 'dismiss' }
  | { type: 'show'; message: AipetTextMessage };

/** Parse `aipet://text` (dismiss) or `aipet://text?tl=&icon=&txt=` (show). */
export function parseAipetTextAction(url: string): AipetTextAction | null {
  if (parseAipetKey(url) !== 'text') {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.search.length <= 1) {
      return { type: 'dismiss' };
    }

    const title = decodeQueryParam(parsed.searchParams.get('tl'));
    const text = decodeQueryParam(parsed.searchParams.get('txt'));

    return {
      type: 'show',
      message: {
        title: title || void 0,
        icon: parseTextIcon(parsed.searchParams.get('icon')),
        text
      }
    };
  } catch {
    return null;
  }
}

/** Convenience wrapper: returns show-message payload only (not dismiss). */
export function parseAipetText(url: string): AipetTextMessage | null {
  const action = parseAipetTextAction(url);
  if (action?.type === 'show') {
    return action.message;
  }
  return null;
}
