/** Fallback session id when `aipet://text` omits `sid`. */
export const DEFAULT_TEXT_SID = 'default';

/** Allowed `sty` / `stp` query values for tool reply routing. */
export const TEXT_SOURCE_VALUES = [
  'claude',
  'codex',
  'cursor',
  'qcode'
] as const;

export type TextSource = (typeof TEXT_SOURCE_VALUES)[number];

export const TEXT_SOURCE_SET = new Set<string>(TEXT_SOURCE_VALUES);
