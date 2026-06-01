import { invoke } from '@tauri-apps/api/core';
import { getCurrent } from '@tauri-apps/plugin-deep-link';

import { AIPET_SCHEME } from './protocol';

const parseAipetHost = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== AIPET_SCHEME) return null;

    return (parsed.host || parsed.pathname.replace(/^\//, '')).toLowerCase();
  } catch {
    //
  }

  return null;
};

/** Prefer the longest URL when plugin and Rust disagree (Windows `cmd` splits on `&`). */
const mergeStartupUrls = (
  pluginUrls: string[] | null,
  rustUrls: string[]
): string[] => {
  if (!rustUrls.length) return pluginUrls ?? [];
  if (!pluginUrls?.length) return rustUrls;

  const merged = [...rustUrls];
  for (const pluginUrl of pluginUrls) {
    const duplicate = merged.find(
      candidate =>
        candidate === pluginUrl ||
        (parseAipetHost(candidate) === parseAipetHost(pluginUrl) &&
          (candidate.startsWith(pluginUrl) || pluginUrl.startsWith(candidate)))
    );
    if (duplicate) {
      if (pluginUrl.length > duplicate.length) {
        const index = merged.indexOf(duplicate);
        merged[index] = pluginUrl;
      }
      continue;
    }

    merged.push(pluginUrl);
  }
  return merged;
};

/** Collect launch-time deep links (argv reconstruction + plugin fallback). */
export const collectStartupDeepLinks = async (): Promise<string[]> => {
  let rustUrls: string[] = [];
  try {
    rustUrls = await invoke<string[]>('collect_deep_link_urls');
  } catch (error) {
    console.warn('collect_deep_link_urls failed:', error);
  }

  const pluginUrls = await getCurrent();
  return mergeStartupUrls(pluginUrls, rustUrls);
};
