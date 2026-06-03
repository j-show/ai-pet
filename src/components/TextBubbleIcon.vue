<template>
  <span class="text-bubble-icon">
    <IconSuccess v-if="icon === 'success'" size="14" />
    <IconInfo v-if="icon === 'info'" size="16" />
    <IconWarn v-if="icon === 'warn'" size="16" />
    <IconError v-if="icon === 'error'" size="18" />
    <span
      v-if="icon === 'loading'"
      class="text-bubble-loading"
      role="status"
      aria-label="加载中"
    />
  </span>
</template>

<script setup lang="ts">
import IconError from '../icons/error.vue';
import IconInfo from '../icons/info.vue';
import IconSuccess from '../icons/success.vue';
import IconWarn from '../icons/warn.vue';
import type { TextIcon } from '../pet/text-message';

/** Parsed `icon` query from `aipet://text` (warn, error, info, success, loading). */
defineProps<{
  icon: TextIcon;
}>();
</script>

<style lang="less" scoped>
.text-bubble-icon {
  display: inline-flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.text-bubble-loading {
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

@keyframes text-bubble-icon-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
