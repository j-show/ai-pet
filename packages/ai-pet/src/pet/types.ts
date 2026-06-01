export type PetState =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review';

export interface PetAtlas {
  columns: number;
  cellWidth: number;
  cellHeight: number;
}

export interface PetAnimation {
  state: PetState;
  row: number;
  frames: number;
  fps?: number;
  loop?: boolean;
}

/** Minimal deployable pet manifest (matches packages/pet-skins/<petId>/pet.json). */
export interface PetManifest {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  atlas?: PetAtlas;
  animations?: PetAnimation[];
  chromaKey?: string;
}

export interface LoadedPet {
  manifest: PetManifest;
  spritesheetUrl: string;
  atlas: PetAtlas;
  animations: Map<PetState, PetAnimation>;
}

export interface SpritePlayerOptions {
  canvas: HTMLCanvasElement;
  spritesheet: HTMLImageElement;
  atlas: PetAtlas;
  scale?: number;
  frameIntervalMs?: number;
  /** Hex color (e.g. `#FF00FF`) made fully transparent when drawing frames. */
  chromaKey?: string;
}

export interface PlayOptions {
  loop?: boolean;
  onComplete?: () => void;
  /** Reset canvas bitmaps before first frame (protocol / external switches). */
  hardSwitch?: boolean;
}

export interface PlayRangeOptions {
  fromFrame: number;
  toFrame: number;
  loop?: boolean;
  onComplete?: () => void;
  /** Reset canvas bitmaps before first frame (e.g. drag phase transitions). */
  hardSwitch?: boolean;
}
