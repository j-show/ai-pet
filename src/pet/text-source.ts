import { TEXT_SOURCE_SET, type TextSource } from '../constants/text';

export type { TextSource };

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
