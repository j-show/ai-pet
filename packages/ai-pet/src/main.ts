import { getCurrentWindow } from '@tauri-apps/api/window';

import { initProtocolDebug } from './config/protocol-debug';
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

const showError = (errorEl: HTMLElement, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  errorEl.hidden = false;
  errorEl.textContent = message;
  console.error(error);
};

const bootstrap = async () => {
  activePet?.destroy();
  activePet = null;

  const canvas = document.querySelector<HTMLCanvasElement>('#pet-canvas');
  const stageEl = document.querySelector<HTMLElement>('#pet-stage');
  const contextMenu = document.querySelector<HTMLElement>('#context-menu');
  const titleEl = document.querySelector<HTMLElement>('#pet-title');
  const errorEl = document.querySelector<HTMLElement>('#error');
  const textBubblesRoot = document.querySelector<HTMLElement>('#text-bubbles');

  if (
    !canvas ||
    !stageEl ||
    !contextMenu ||
    !titleEl ||
    !errorEl ||
    !textBubblesRoot
  ) {
    throw new Error('Missing required DOM nodes');
  }

  const params = new URLSearchParams(window.location.search);
  const userEnv = await loadUserEnv();
  initProtocolDebug({ urlParams: params, env: userEnv });
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
      textBubblesRoot
    );
    await pet.init(petId, animationTickMs, userEnv);
    activePet = pet;
    setFocusRepaintHandler(() => {
      activePet?.refreshDisplay();
    });
    bindAipetDevProtocol(pet);
    await bindAipetProtocol(pet);
  } catch (error) {
    showError(errorEl, error);
  }
};

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
