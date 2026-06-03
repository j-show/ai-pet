<template>
  <menu ref="rootRef" class="pet-context-menu" hidden>
    <button type="button" @click="emit('quit')">退出</button>
  </menu>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  quit: [];
}>();

const rootRef = ref<HTMLElement | null>(null);

defineExpose({
  get element() {
    return rootRef.value;
  }
});
</script>

<style lang="less" scoped>
.pet-context-menu {
  position: fixed;
  padding: 4px;
  border: 1px solid var(--menu-border);
  border-radius: 8px;
  background: var(--menu-bg);
  box-shadow: var(--menu-shadow);
  z-index: 10;

  button {
    width: 100%;
    border: 0;
    border-radius: 6px;
    padding: 8px 12px;
    background: transparent;
    color: var(--menu-text);
    text-align: left;
    font-size: 13px;
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background: var(--menu-hover);
    }
  }
}
</style>
