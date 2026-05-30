import { getCurrentWindow } from '@tauri-apps/api/window';

import {
  applyThemeSetting,
  envAnimationTickMs,
  envPetId,
  envThemeSetting,
  loadUserEnv
} from './config/user-env';
import { DEFAULT_PET_ID } from './pet/codex-defaults';
import {
  initCompositorRefresh,
  setFocusRepaintHandler
} from './pet/compositor-refresh';
import { DesktopPet } from './pet/desktop-pet';
import {
  bindAipetDevProtocol,
  bindAipetProtocol
} from './pet/protocol-handler';

let activePet: DesktopPet | null = null;

function showError(errorEl: HTMLElement, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  errorEl.hidden = false;
  errorEl.textContent = message;
  console.error(error);
}

async function bootstrap() {
  activePet?.destroy();
  activePet = null;

  const canvas = document.querySelector<HTMLCanvasElement>('#pet-canvas');
  const stageEl = document.querySelector<HTMLElement>('#pet-stage');
  const contextMenu = document.querySelector<HTMLElement>('#context-menu');
  const titleEl = document.querySelector<HTMLElement>('#pet-title');
  const errorEl = document.querySelector<HTMLElement>('#error');
  const textBubbleRoot = document.querySelector<HTMLElement>('#text-bubble');
  const textBubbleClose =
    document.querySelector<HTMLButtonElement>('#text-bubble-close');
  const textBubbleHeader = document.querySelector<HTMLElement>(
    '#text-bubble-header'
  );
  const textBubbleTitle =
    document.querySelector<HTMLElement>('#text-bubble-title');
  const textBubbleIcon =
    document.querySelector<HTMLElement>('#text-bubble-icon');
  const textBubbleContent = document.querySelector<HTMLElement>(
    '#text-bubble-content'
  );

  if (
    !canvas ||
    !stageEl ||
    !contextMenu ||
    !titleEl ||
    !errorEl ||
    !textBubbleRoot ||
    !textBubbleClose ||
    !textBubbleHeader ||
    !textBubbleTitle ||
    !textBubbleIcon ||
    !textBubbleContent
  ) {
    throw new Error('Missing required DOM nodes');
  }

  const params = new URLSearchParams(window.location.search);
  const userEnv = await loadUserEnv();
  const petId = params.get('pet') ?? envPetId(userEnv) ?? DEFAULT_PET_ID;
  const animationTickMs = envAnimationTickMs(userEnv);
  applyThemeSetting(envThemeSetting(userEnv));

  try {
    await getCurrentWindow().setAlwaysOnTop(true);
  } catch (error) {
    console.warn('Failed to set always on top:', error);
  }

  await initCompositorRefresh();

  try {
    const pet = new DesktopPet(
      canvas,
      stageEl,
      contextMenu,
      titleEl,
      textBubbleRoot,
      textBubbleClose,
      textBubbleHeader,
      textBubbleTitle,
      textBubbleIcon,
      textBubbleContent
    );
    await pet.init(petId, animationTickMs);
    activePet = pet;
    setFocusRepaintHandler(() => {
      activePet?.refreshDisplay();
    });
    bindAipetDevProtocol(pet);
    await bindAipetProtocol(pet);
  } catch (error) {
    showError(errorEl, error);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  void bootstrap();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    setFocusRepaintHandler(null);
    activePet?.destroy();
    activePet = null;
  });
}
