<template>
  <div ref="canvasWrapRef" class="pet-canvas-wrap">
    <canvas
      ref="canvasRef"
      class="pet-canvas"
      aria-label="desktop pet"
    ></canvas>
    <button
      type="button"
      ref="scaleHandleRef"
      class="pet-scale-handle"
      aria-label="拖动缩放宠物"
      title="拖动缩放宠物"
    >
      <span class="pet-scale-handle__icon">
        <IconScale />
      </span>
    </button>
  </div>
  <p class="sr-only">{{ displayName }}</p>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import IconScale from '../icons/scale.vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasWrapRef = ref<HTMLElement | null>(null);
const scaleHandleRef = ref<HTMLButtonElement | null>(null);
const displayName = ref('');

export interface PetStageNodes {
  canvas: HTMLCanvasElement;
  canvasWrap: HTMLElement;
  scaleHandle: HTMLButtonElement;
}

defineExpose({
  setDisplayName(name: string) {
    displayName.value = name;
    document.title = name;
  },
  getNodes(): PetStageNodes | null {
    const canvas = canvasRef.value;
    const canvasWrap = canvasWrapRef.value;
    const scaleHandle = scaleHandleRef.value;
    if (!canvas || !canvasWrap || !scaleHandle) {
      return null;
    }
    return { canvas, canvasWrap, scaleHandle };
  }
});
</script>

<style lang="less" scoped>
.pet-canvas-wrap {
  position: relative;
  display: inline-block;
  width: fit-content;
  height: fit-content;
}

.pet-canvas {
  display: block;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-drag: none;
  isolation: isolate;

  &:active {
    cursor: grabbing;
  }
}

.pet-scale-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--scale-handle-fg);
  cursor: nwse-resize;
  touch-action: none;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 48px;
    height: 48px;
    transform: translate(-50%, -50%);
    border-radius: 12px;
  }

  &:hover,
  &:focus-visible,
  &:active {
    opacity: 1;

    .pet-scale-handle__icon {
      transform: scale(1);
    }
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--scale-handle-border);
    border-radius: 6px;
    background: var(--scale-handle-bg);
    box-shadow: var(--scale-handle-shadow);
    transform: scale(0.88);
    transition: transform 0.15s ease;

    svg {
      display: block;
    }
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
