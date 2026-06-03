<template>
  <div
    ref="rootRef"
    class="text-bubble"
    :class="bubbleClass"
    :style="positionStyle"
    :data-sid="message.sid"
  >
    <button
      type="button"
      class="text-bubble__close"
      aria-label="关闭"
      @click.stop="emit('dismiss')"
    >
      ×
    </button>
    <div
      v-if="hasHeader"
      class="text-bubble__header"
      :class="{ 'text-bubble__header--icon-only': headerIconOnly }"
    >
      <p v-if="title" class="text-bubble__title">{{ title }}</p>
      <span
        v-if="message.icon"
        class="text-bubble__icon"
        :class="`text-bubble__icon--${message.icon}`"
        :aria-hidden="message.icon === 'loading' ? undefined : 'true'"
        :role="message.icon === 'loading' ? 'status' : undefined"
        :aria-label="message.icon === 'loading' ? '加载中' : undefined"
      >
        {{ iconLabel }}
      </span>
    </div>
    <p v-if="body" class="text-bubble__content">{{ body }}</p>
    <button
      v-if="message.reply"
      type="button"
      class="text-bubble__reply"
      @click.stop="toggleComposer"
    >
      回复
    </button>

    <div
      v-show="composerOpen"
      ref="composerRef"
      class="text-bubble-composer"
      :style="composerStyle"
    >
      <textarea
        ref="composerInputRef"
        v-model="composerDraft"
        class="text-bubble-composer__input"
        rows="2"
        placeholder="回复"
        aria-label="回复内容"
        @keydown="onComposerKeydown"
      ></textarea>
      <button
        type="button"
        class="text-bubble-composer__send"
        aria-label="发送"
        :disabled="composerSending"
        @click="submitComposer"
      >
        <IconSend />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

import { sendToolReply } from '../config/tool-reply';
import IconSend from '../icons/IconSend.vue';
import { TEXT_BUBBLE_ICON_LABELS } from '../constants/text-bubble';
import type { AipetTextMessage } from '../pet/text-message';

const props = defineProps<{
  message: AipetTextMessage;
  left?: number;
  top?: number;
  visible?: boolean;
  /** Parent closes other bubbles' composers when one is active. */
  composerActive?: boolean;
}>();

const emit = defineEmits<{
  dismiss: [];
  'composer-change': [open: boolean];
  'layout-change': [];
}>();

const rootRef = ref<HTMLElement | null>(null);
const composerRef = ref<HTMLElement | null>(null);
const composerInputRef = ref<HTMLTextAreaElement | null>(null);
const composerOpen = ref(false);
const composerDraft = ref('');
const composerSending = ref(false);
const composerStyle = ref({ left: '0px', top: '0px' });

const title = computed(() => props.message.title?.trim() ?? '');
const body = computed(() => props.message.text ?? '');
const hasHeader = computed(() => Boolean(title.value || props.message.icon));
const headerIconOnly = computed(
  () => !title.value && Boolean(props.message.icon)
);

const iconLabel = computed(() => {
  const icon = props.message.icon;
  if (!icon || icon === 'loading') {
    return '';
  }
  return TEXT_BUBBLE_ICON_LABELS[icon];
});

const bubbleClass = computed(() => ({
  'text-bubble--visible': props.visible,
  'text-bubble--title-only': Boolean(title.value && !body.value),
  'text-bubble--replyable': Boolean(props.message.reply)
}));

const positionStyle = computed(() => {
  if (props.left == null || props.top == null) {
    return undefined;
  }
  return {
    left: `${props.left}px`,
    top: `${props.top}px`
  };
});

const closeComposer = () => {
  if (!composerOpen.value) {
    return;
  }
  composerOpen.value = false;
  composerDraft.value = '';
  composerSending.value = false;
  emit('composer-change', false);
  emit('layout-change');
};

const openComposer = () => {
  const root = rootRef.value;
  const target = props.message.reply;
  if (!root || !target) {
    return;
  }

  const rect = root.getBoundingClientRect();
  composerDraft.value = '';
  composerSending.value = false;
  composerStyle.value = {
    left: `${Math.max(8, rect.right - 220)}px`,
    top: `${rect.bottom + 6}px`
  };
  composerOpen.value = true;
  emit('composer-change', true);
  emit('layout-change');
  void nextTick(() => {
    composerInputRef.value?.focus();
  });
};

const toggleComposer = () => {
  if (composerOpen.value) {
    closeComposer();
    return;
  }
  openComposer();
};

const submitComposer = async () => {
  const target = props.message.reply;
  if (composerSending.value || !target) {
    return;
  }

  const text = composerDraft.value.trim();
  if (!text) {
    return;
  }

  composerSending.value = true;

  try {
    await sendToolReply(target.sty, target.sid, text);
    closeComposer();
  } catch (error) {
    console.warn('[ai-pet] tool reply failed:', error);
    composerSending.value = false;
  }
};

const onComposerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void submitComposer();
  }
  if (event.key === 'Escape') {
    closeComposer();
  }
};

const onDocumentPointerDown = (event: PointerEvent) => {
  if (!composerOpen.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (composerRef.value?.contains(target) || rootRef.value?.contains(target)) {
    return;
  }

  closeComposer();
};

watch(
  () => props.composerActive,
  active => {
    if (!active) {
      closeComposer();
    }
  }
);

watch(
  () => props.message,
  () => {
    if (!props.message.reply) {
      closeComposer();
    }
  }
);

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
});

watch(composerOpen, open => {
  if (open) {
    document.addEventListener('pointerdown', onDocumentPointerDown);
    return;
  }
  document.removeEventListener('pointerdown', onDocumentPointerDown);
});

defineExpose({
  getElement: () => rootRef.value
});
</script>

<style lang="less" scoped>
.text-bubble {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  width: max-content;
  max-width: 200px;
  padding: 8px;
  background: var(--bubble-bg);
  border: 1px solid var(--bubble-border);
  border-radius: 8px;
  box-shadow: var(--bubble-shadow);
  opacity: 0;
  transform: translate(-100%, 0);
  transition: opacity 0.24s ease;

  &--visible {
    opacity: 1;
  }

  &--title-only {
    .text-bubble__header {
      margin-bottom: 0;
    }
  }

  &--replyable {
    padding-bottom: 28px;

    &:hover .text-bubble__reply {
      opacity: 1;
      pointer-events: auto;
    }
  }

  &:hover {
    .text-bubble__close {
      opacity: 1;
      pointer-events: auto;
    }

    .text-bubble__header:not(.text-bubble__header--icon-only):not([hidden]) {
      padding-left: 22px;
    }

    .text-bubble__header[hidden] ~ .text-bubble__content:not([hidden]) {
      padding-left: 22px;
    }
  }

  &__close {
    position: absolute;
    top: 9px;
    left: 6px;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--bubble-close-border);
    border-radius: 50%;
    background: var(--bubble-close-bg);
    color: var(--bubble-close-fg);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;

    &:hover {
      background: var(--bubble-close-hover-bg);
      color: var(--bubble-close-hover-fg);
      border-color: var(--bubble-close-hover-border);
      box-shadow: var(--bubble-close-hover-shadow);
      transform: scale(1.1);
      font-weight: 700;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    &:not(:last-child) {
      margin-bottom: 4px;
    }

    &--icon-only {
      justify-content: flex-end;
    }
  }

  &__title {
    margin: 0;
    flex: 1;
    min-width: 0;
    color: var(--bubble-title);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 12px;
    line-height: 1;

    &--warn {
      width: 22px;
      height: 20px;
      border-radius: 0;
      color: #ffffff;
      background: #f59e0b;
      clip-path: polygon(50% 6%, 6% 94%, 94% 94%);
      font-weight: 800;
      padding-top: 4px;
    }

    &--error {
      color: var(--bubble-icon-error-fg);
      background: var(--bubble-icon-error-bg);
    }

    &--info {
      color: #ffffff;
      background: #2563eb;
    }

    &--loading {
      color: transparent;

      &::before {
        content: '';
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: conic-gradient(
          from 90deg,
          var(--bubble-icon-loading) 0deg,
          transparent 300deg
        );
        -webkit-mask: radial-gradient(
          farthest-side,
          transparent calc(100% - 2px),
          #000 calc(100% - 2px)
        );
        mask: radial-gradient(
          farthest-side,
          transparent calc(100% - 2px),
          #000 calc(100% - 2px)
        );
        animation: text-bubble-icon-spin 0.8s linear infinite;
      }
    }
  }

  &__content {
    margin: 0;
    min-width: 0;
    color: var(--bubble-content);
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre-line;
    word-break: break-word;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
    line-clamp: 5;
  }

  &__reply {
    position: absolute;
    right: 8px;
    bottom: 6px;
    z-index: 3;
    padding: 2px 8px;
    border: 1px solid var(--bubble-border);
    border-radius: 999px;
    background: var(--bubble-bg);
    color: var(--bubble-content);
    font-size: 12px;
    line-height: 1.4;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.15s ease,
      background-color 0.15s ease,
      border-color 0.15s ease,
      transform 0.15s ease;

    &:hover {
      background: var(--bubble-close-hover-bg);
      border-color: var(--bubble-close-hover-border);
      transform: scale(1.04);
    }
  }
}

@keyframes text-bubble-icon-spin {
  to {
    transform: rotate(360deg);
  }
}

.text-bubble-composer {
  position: fixed;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  width: 220px;
  padding: 8px;
  border: 1px solid var(--bubble-border);
  border-radius: 12px;
  background: var(--bubble-bg);
  box-shadow: var(--bubble-shadow);

  &__input {
    flex: 1;
    min-width: 0;
    min-height: 36px;
    max-height: 96px;
    padding: 6px 8px;
    border: 1px solid var(--bubble-border);
    border-radius: 8px;
    background: transparent;
    color: var(--bubble-content);
    font: inherit;
    font-size: 13px;
    line-height: 1.4;
    resize: vertical;

    &:focus {
      outline: 2px solid color-mix(in srgb, #2563eb 55%, transparent);
      outline-offset: 1px;
    }
  }

  &__send {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #6b7280;
    color: #ffffff;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      transform 0.15s ease,
      opacity 0.15s ease;

    &:hover:not(:disabled) {
      background: #4b5563;
      transform: scale(1.05);
    }

    &:disabled {
      opacity: 0.55;
      cursor: default;
    }
  }
}
</style>
