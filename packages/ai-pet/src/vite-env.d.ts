/// <reference types="vite/client" />

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
