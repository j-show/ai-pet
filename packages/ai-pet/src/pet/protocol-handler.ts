import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';

import type { DesktopPet } from './desktop-pet';
import { parseAipetCommand, parseAipetTextAction } from './protocol';

/**
 * Dispatch one or more `aipet://` URLs to the desktop pet instance.
 * Handles text show/dismiss, base idle reset, and animation commands.
 */
export function handleAipetUrls(pet: DesktopPet, urls: string[]) {
  for (const url of urls) {
    const textAction = parseAipetTextAction(url);
    if (textAction?.type === 'dismiss') {
      pet.dismissProtocolText();
      continue;
    }

    if (textAction?.type === 'show') {
      pet.showProtocolText(textAction.message);
      continue;
    }

    const command = parseAipetCommand(url);
    if (command?.type === 'base') {
      pet.enterAutoPlay();
      continue;
    }

    if (command?.type === 'animation') {
      pet.playProtocolAnimation(
        command.state,
        command.loop,
        command.count,
        command.defaultMode
      );
      continue;
    }

    console.warn(`Unknown aipet URL: ${url}`);
  }
}

/** Bind deep-link plugin: process launch URLs and future `onOpenUrl` events. */
export async function bindAipetProtocol(pet: DesktopPet) {
  const startUrls = await getCurrent();
  if (startUrls?.length) {
    handleAipetUrls(pet, startUrls);
  }

  await onOpenUrl(urls => {
    handleAipetUrls(pet, urls);
  });
}

type HmrData = { url?: string };

/** Dev-only: receive protocol URLs from Vite middleware via HMR custom event. */
export function bindAipetDevProtocol(pet: DesktopPet) {
  if (!import.meta.hot) {
    return;
  }

  const onProtocol = (data: HmrData) => {
    if (data?.url) {
      handleAipetUrls(pet, [data.url]);
    }
  };

  import.meta.hot.on('aipet-protocol', onProtocol);

  import.meta.hot.dispose(() => {
    import.meta.hot?.off('aipet-protocol', onProtocol);
  });
}
