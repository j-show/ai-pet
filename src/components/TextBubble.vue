<template>
  <div
    ref="rootRef"
    class="text-bubble"
    :class="{
      'text-bubble--visible': !!visible,
      'text-bubble--title-only': !!title && !body,
      'text-bubble--replyable': composerOpen
    }"
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
      v-if="!!title || !!message.icon"
      class="text-bubble__header"
      :class="{
        'text-bubble__header--icon-only': !title && !!message.icon
      }"
    >
      <p v-if="title" class="text-bubble__title" @click.stop="closeComposer">
        {{ title }}
      </p>
      <TextBubbleIcon v-if="message.icon" :icon="message.icon" />
    </div>
    <div v-if="body" class="text-bubble__content-container">
      <p class="text-bubble__content">{{ body }}</p>
      <button
        v-if="message.reply && !composerOpen"
        type="button"
        class="text-bubble__reply"
        @click.stop="toggleComposer"
      >
        回复
      </button>
      <div v-if="composerOpen" ref="composerRef" class="text-bubble-composer">
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

import { sendToolReply } from '../config/tool-reply';
import IconSend from '../icons/send.vue';
import type { AipetTextMessage } from '../pet/text-message';

import TextBubbleIcon from './TextBubbleIcon.vue';

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

const title = computed(() => (props.message.title || '').trim());
const body = computed(() => (props.message.text || '').trim());

const positionStyle = computed(() => {
  if (props.left == null || props.top == null) {
    return null;
  }
  return {
    left: `${props.left}px`,
    top: `${props.top}px`
  };
});

const closeComposer = () => {
  if (!composerOpen.value) return;

  composerOpen.value = false;
  composerDraft.value = '';
  composerSending.value = false;
  emit('composer-change', false);
  emit('layout-change');
};

const openComposer = () => {
  const root = rootRef.value;
  const target = props.message.reply;
  if (!root || !target) return;

  composerOpen.value = true;
  composerDraft.value = '';
  composerSending.value = false;

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
  width: max-content;
  max-width: 200px;
  padding: 8px;
  border: 1px solid var(--bubble-border);
  border-radius: 8px;
  background: var(--bubble-bg);
  box-shadow: var(--bubble-shadow);
  opacity: 0;
  transform: translate(-100%, 0);
  transition: opacity 0.24s ease;

  &:hover,
  &.text-bubble--replyable {
    .text-bubble__close {
      opacity: 1;
    }

    .text-bubble__header:not(.text-bubble__header--icon-only):not([hidden]) {
      padding-left: 22px;
    }

    .text-bubble__header[hidden] ~ .text-bubble__content:not([hidden]) {
      padding-left: 22px;
    }

    .text-bubble__reply {
      opacity: 1;
    }
  }
}

.text-bubble--visible {
  opacity: 1;
}

.text-bubble--title-only {
  .text-bubble__header {
    margin-bottom: 0;
  }
}

.text-bubble__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  &:not(:last-child) {
    margin-bottom: 4px;
  }
}

.text-bubble__header--icon-only {
  justify-content: flex-end;
}

.text-bubble__title {
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

.text-bubble__content-container {
  position: relative;
  min-width: 0;
}

.text-bubble__content {
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

.text-bubble__close {
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

.text-bubble__reply {
  position: absolute;
  right: 0px;
  top: 0;
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
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;

  &:hover {
    background: var(--bubble-reply-hover-bg);
    color: var(--bubble-reply-hover-fg);
    border-color: var(--bubble-reply-hover-border);
    box-shadow: var(--bubble-reply-hover-shadow);
    transform: scale(1.04);
  }
}

.text-bubble-composer {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
}

.text-bubble-composer__input {
  flex: 1;
  padding: 6px;
  border: 1px solid var(--bubble-border);
  border-radius: 8px;
  background: transparent;
  color: var(--bubble-content);
  font-size: 13px;
  line-height: 1.4;
  outline: 0;
  resize: none;

  &:focus {
    border-color: color-mix(in srgb, #2563eb 55%, transparent);
    outline: 0;
  }
}

.text-bubble-composer__send {
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
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
</style>
