/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly hot?: import('vite').ViteHotContext;
}

interface AipetProtocolPayload {
  url: string;
}

interface ImportMetaHotEventMap {
  'aipet-protocol': AipetProtocolPayload;
}
