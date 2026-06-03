<template>
  <div class="text-bubbles">
    <template v-for="sid in order" :key="sid">
      <TextBubble
        v-if="messageFor(sid)"
        :ref="el => setBubbleRef(sid, el)"
        :message="messageFor(sid)!"
        :left="positionFor(sid)?.left"
        :top="positionFor(sid)?.top"
        :visible="animVisible.has(sid)"
        :composer-active="activeComposerSid === sid"
        @dismiss="dismiss(sid)"
        @composer-change="open => onComposerChange(sid, open)"
        @layout-change="notifyResize"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, triggerRef } from 'vue';

import { BUBBLE_STACK_GAP_PX } from '../constants/text-bubble';
import type { AipetTextMessage } from '../pet/text-message';
import {
  type TextBubbleBox,
  type TextBubblesController
} from '../pet/text-bubble';
import TextBubble from './TextBubble.vue';

const emit = defineEmits<{
  resize: [];
}>();

interface TextBubbleExpose {
  getElement: () => HTMLElement | null;
}

const messages = ref(new Map<string, AipetTextMessage>());
const order = ref<string[]>([]);
const positions = ref(new Map<string, { left: number; top: number }>());
const animVisible = ref(new Set<string>());
const activeComposerSid = ref<string | null>(null);

const bubbleRefs = new Map<string, HTMLElement>();

const messageFor = (sid: string) => messages.value.get(sid);

const positionFor = (sid: string) => positions.value.get(sid);

const setBubbleRef = (sid: string, el: unknown) => {
  if (el && typeof el === 'object' && 'getElement' in el) {
    const root = (el as TextBubbleExpose).getElement();
    if (root) {
      bubbleRefs.set(sid, root);
      return;
    }
  }
  bubbleRefs.delete(sid);
};

const notifyResize = () => {
  emit('resize');
};

const onComposerChange = (sid: string, open: boolean) => {
  if (open) {
    activeComposerSid.value = sid;
  } else if (activeComposerSid.value === sid) {
    activeComposerSid.value = null;
  }
  notifyResize();
};

const playEnterAnimation = async (sid: string) => {
  animVisible.value.delete(sid);
  triggerRef(animVisible);
  await nextTick();
  void bubbleRefs.get(sid)?.offsetWidth;
  animVisible.value.add(sid);
  triggerRef(animVisible);
};

const removeEntry = (sid: string) => {
  if (!messages.value.has(sid)) {
    return;
  }

  if (activeComposerSid.value === sid) {
    activeComposerSid.value = null;
  }

  messages.value.delete(sid);
  triggerRef(messages);
  const index = order.value.indexOf(sid);
  if (index >= 0) {
    order.value.splice(index, 1);
  }
  positions.value.delete(sid);
  triggerRef(positions);
  animVisible.value.delete(sid);
  triggerRef(animVisible);
  bubbleRefs.delete(sid);
};

const show: TextBubblesController['show'] = message => {
  const sid = message.sid;
  const title = message.title?.trim() ?? '';
  const text = message.text ?? '';

  if (!title && !text && !message.icon) {
    dismiss(sid);
    return;
  }

  const isNew = !messages.value.has(sid);
  messages.value.set(sid, message);
  triggerRef(messages);
  if (isNew) {
    order.value.push(sid);
  }

  void playEnterAnimation(sid);
  notifyResize();
};

const dismiss: TextBubblesController['dismiss'] = sid => {
  if (sid == null) {
    activeComposerSid.value = null;
    for (const id of [...order.value]) {
      removeEntry(id);
    }
    notifyResize();
    return;
  }

  if (!messages.value.has(sid)) {
    return;
  }

  removeEntry(sid);
  notifyResize();
};

const layoutAtAnchor: TextBubblesController['layoutAtAnchor'] = anchor => {
  let topY = anchor.y;
  for (const sid of order.value) {
    const el = bubbleRefs.get(sid);
    if (!el || !messages.value.has(sid)) {
      continue;
    }

    positions.value.set(sid, { left: anchor.x, top: topY });
    topY += el.offsetHeight + BUBBLE_STACK_GAP_PX;
  }
  triggerRef(positions);
};

const isVisible: TextBubblesController['isVisible'] = () =>
  order.value.some(sid => messages.value.has(sid));

const measureBubbleBox = (
  el: HTMLElement,
  anchorX: number,
  topY: number
): TextBubbleBox => {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  const left = anchorX - width;
  const top = topY;
  return {
    left,
    top,
    right: anchorX,
    bottom: topY + height,
    width,
    height
  };
};

const measureBox: TextBubblesController['measureBox'] = anchor => {
  if (!isVisible()) {
    return null;
  }

  let minX = anchor.x;
  let minY = anchor.y;
  let maxX = anchor.x;
  let maxY = anchor.y;
  let topY = anchor.y;

  for (const sid of order.value) {
    const el = bubbleRefs.get(sid);
    if (!el || !messages.value.has(sid)) {
      continue;
    }

    const box = measureBubbleBox(el, anchor.x, topY);
    minX = Math.min(minX, box.left);
    minY = Math.min(minY, box.top);
    maxX = Math.max(maxX, box.right);
    maxY = Math.max(maxY, box.bottom);
    topY += box.height + BUBBLE_STACK_GAP_PX;
  }

  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};

defineExpose<TextBubblesController>({
  show,
  dismiss,
  layoutAtAnchor,
  isVisible,
  measureBox
});
</script>

<style lang="less" scoped>
.text-bubbles {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;

  :deep(.text-bubble) {
    pointer-events: auto;
  }
}
</style>
