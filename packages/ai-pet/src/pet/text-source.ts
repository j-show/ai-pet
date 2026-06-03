/**
 * Text protocol source tool identifiers and reply routing metadata.
 * @module pet/text-source
 */

/** Source IDE/agent for `aipet://text?sty=` (alias `stp` from ai-pet-helper). */
export type TextSource = 'claude' | 'codex' | 'cursor' | 'qcode';

/** Allowed `sty` query values. */
export const TEXT_SOURCE_VALUES: readonly TextSource[] = [
  'claude',
  'codex',
  'cursor',
  'qcode'
] as const;

const TEXT_SOURCE_SET = new Set<string>(TEXT_SOURCE_VALUES);

/** Reply routing: which tool and session to send user input to. */
export interface TextReplyTarget {
  sty: TextSource;
  sid: string;
}

/**
 * Parse `sty` / `stp` query value.
 * @returns Normalized tool id, or null when missing or unknown.
 */
export const parseTextSource = (raw: string | null): TextSource | null => {
  const value = raw?.trim().toLowerCase() ?? '';
  if (!value || !TEXT_SOURCE_SET.has(value)) return null;

  return value as TextSource;
};
