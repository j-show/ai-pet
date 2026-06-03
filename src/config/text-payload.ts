import { invoke } from '@tauri-apps/api/core';

export type TextPayloadFile = {
  title?: string;
  text?: string;
};

/** Read full text bubble body written by ai-pet-helper (`~/.ai-pet/messages/<sid>.json`). */
export const loadTextPayload = async (
  sid: string
): Promise<TextPayloadFile | null> => {
  const trimmed = sid.trim();
  if (!trimmed) return null;

  try {
    return await invoke('read_text_payload', { sid: trimmed });
  } catch {
    //
  }

  return null;
};
