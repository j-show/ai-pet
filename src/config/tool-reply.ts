import { invoke } from '@tauri-apps/api/core';

import type { TextSource } from '../pet/text-source';

/**
 * Submit reply text to the IDE/agent identified by `sty`.
 * Dispatches via Tauri `send_tool_reply` (CLI spawn + inbox JSON under `~/.ai-pet/replies/inbox/`).
 * @param sty Target tool (`claude` | `codex` | `cursor` | `qcode`).
 * @param sid Session id from the originating `aipet://text?sid=` URL.
 * @param text Trimmed user message; empty strings are rejected in Rust.
 */
export const sendToolReply = async (
  sty: TextSource,
  sid: string,
  text: string
): Promise<void> => {
  await invoke('send_tool_reply', { sty, sid, text });
};
