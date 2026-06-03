<template>
  <div class="app-shell">
    <div ref="stageRef" class="app-stage">
      <PetStage ref="petStageRef" />
      <TextBubbles ref="textBubblesRef" @resize="onTextBubblesResize" />
    </div>
    <PetContextMenu ref="contextMenuRef" @quit="onQuit" />
    <p v-if="errorMessage" class="app-error">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';

import { getCurrentWindow } from '@tauri-apps/api/window';

import PetContextMenu from './components/PetContextMenu.vue';
import PetStage from './components/PetStage.vue';
import TextBubbles from './components/TextBubbles.vue';
import { initProtocolDebug } from './config/protocol-debug';
import {
  applyThemeSetting,
  envAnimationTickMs,
  envPetId,
  envThemeSetting,
  loadUserEnv
} from './config/user-env';
import { DEFAULT_PET_ID } from './constants/pet';
import {
  initCompositorRefresh,
  setFocusRepaintHandler
} from './pet/compositor-refresh';
import { DesktopPet } from './pet/desktop-pet';
import {
  bindAipetDevProtocol,
  bindAipetProtocol,
  unbindAipetProtocol
} from './pet/protocol-handler';

const stageRef = ref<HTMLElement | null>(null);
const petStageRef = ref<InstanceType<typeof PetStage> | null>(null);
const textBubblesRef = ref<InstanceType<typeof TextBubbles> | null>(null);
const contextMenuRef = ref<InstanceType<typeof PetContextMenu> | null>(null);
const errorMessage = ref('');

const activePet = shallowRef<DesktopPet | null>(null);

const onTextBubblesResize = () => {
  void activePet.value?.resizeWindowForBubbles();
};

const onQuit = () => {
  void getCurrentWindow().close();
};

const destroyPet = () => {
  unbindAipetProtocol();
  setFocusRepaintHandler(null);
  activePet.value?.destroy();
  activePet.value = null;
};

const bootstrap = async () => {
  destroyPet();
  errorMessage.value = '';

  const stageEl = stageRef.value;
  const petNodes = petStageRef.value?.getNodes() ?? null;
  const textBubbles = textBubblesRef.value;
  const contextMenu = contextMenuRef.value?.element ?? null;

  if (!stageEl || !petNodes || !textBubbles || !contextMenu) {
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
      petNodes.canvas,
      petNodes.canvasWrap,
      petNodes.scaleHandle,
      stageEl,
      contextMenu,
      name => petStageRef.value?.setDisplayName(name),
      textBubbles
    );
    await pet.init(petId, animationTickMs, userEnv);
    activePet.value = pet;
    setFocusRepaintHandler(() => {
      activePet.value?.refreshDisplay();
    });
    bindAipetDevProtocol(pet);
    await bindAipetProtocol(pet);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = message;
    console.error(error);
  }
};

onMounted(() => {
  void bootstrap();
});

onUnmounted(() => {
  destroyPet();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyPet();
  });
}
</script>

<style lang="less" scoped>
.app-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-stage {
  position: absolute;
  top: 0;
  left: 0;
  width: fit-content;
  height: fit-content;
}

.app-error {
  position: fixed;
  inset: 8px;
  margin: 0;
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 235, 235, 0.95);
  color: #8b1e1e;
  font-size: 12px;
}
</style>
