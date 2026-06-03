import { onOpenUrl } from '@tauri-apps/plugin-deep-link';

import { logProtocolReceived } from '../config/protocol-debug';

import type { DesktopPet } from './desktop-pet';
import { parseAipetCommand, parseAipetTextAction } from './protocol';
import { collectStartupDeepLinks } from './startup-deep-links';

let unlistenOpenUrl: (() => void) | null = null;

/** Stop handling runtime `onOpenUrl` events (e.g. before pet teardown). */
export const unbindAipetProtocol = () => {
  unlistenOpenUrl?.();
  unlistenOpenUrl = null;
};

/**
 * Dispatch one or more `aipet://` URLs to the desktop pet instance.
 * Handles text show/dismiss, base idle reset, and animation commands.
 */
export const handleAipetUrls = async (pet: DesktopPet, urls: string[]) => {
  for (const url of urls) {
    const textAction = parseAipetTextAction(url);
    if (textAction?.type === 'dismiss') {
      logProtocolReceived(url, { kind: 'text', action: textAction });
      pet.dismissProtocolText(textAction.sid);
      continue;
    }

    if (textAction?.type === 'show') {
      logProtocolReceived(url, { kind: 'text', action: textAction });
      await pet.showProtocolText(textAction.message);
      continue;
    }

    const command = parseAipetCommand(url);
    if (command?.type === 'base') {
      logProtocolReceived(url, { kind: 'command', command });
      pet.enterAutoPlay();
      continue;
    }

    if (command?.type === 'animation') {
      logProtocolReceived(url, { kind: 'command', command });
      pet.playProtocolAnimation(
        command.state,
        command.loop,
        command.count,
        command.defaultMode
      );
      continue;
    }

    logProtocolReceived(url, { kind: 'unknown' });
    console.warn(`Unknown aipet URL: ${url}`);
  }
};

/** Bind deep-link plugin: process launch URLs and future `onOpenUrl` events. */
export const bindAipetProtocol = async (pet: DesktopPet) => {
  const startUrls = await collectStartupDeepLinks();
  if (startUrls.length) {
    await handleAipetUrls(pet, startUrls);
  }

  unbindAipetProtocol();
  unlistenOpenUrl = await onOpenUrl(urls => {
    void handleAipetUrls(pet, urls);
  });
};

type HmrData = { url?: string };

/** Dev-only: receive protocol URLs from Vite middleware via HMR custom event. */
export const bindAipetDevProtocol = (pet: DesktopPet) => {
  if (!import.meta.hot) return;

  const onProtocol = (data: HmrData) => {
    if (data?.url) {
      void handleAipetUrls(pet, [data.url]);
    }
  };

  import.meta.hot.on('aipet-protocol', onProtocol);

  import.meta.hot.dispose(() => {
    import.meta.hot?.off('aipet-protocol', onProtocol);
  });
};
