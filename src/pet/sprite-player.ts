import { DEFAULT_ANIMATION_TICK_MS } from '../constants/env';
import { CHROMA_TOLERANCE } from '../constants/sprite';

import { requestTransparentRepaint } from './compositor-refresh';
import type {
  PetAnimation,
  PlayOptions,
  PlayRangeOptions,
  SpritePlayerOptions
} from './types';

/** One active player per canvas — stops orphaned rAF loops after HMR reload. */
const canvasOwner = new WeakMap<HTMLCanvasElement, SpritePlayer>();

const parseHexColor = (
  hex: string
): { r: number; g: number; b: number } | null => {
  const normalized = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff
  };
};

const applyChromaKey = (
  imageData: ImageData,
  chromaRgb: { r: number; g: number; b: number }
) => {
  const { r: kr, g: kg, b: kb } = chromaRgb;
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    if (
      Math.abs(data[i] - kr) <= CHROMA_TOLERANCE &&
      Math.abs(data[i + 1] - kg) <= CHROMA_TOLERANCE &&
      Math.abs(data[i + 2] - kb) <= CHROMA_TOLERANCE
    ) {
      data[i + 3] = 0;
    }
  }
};

/** Bake chroma key once so runtime frames never need getImageData/putImageData. */
const prepareSpritesheet = (
  image: HTMLImageElement,
  chromaRgb: { r: number; g: number; b: number } | null
): CanvasImageSource => {
  if (!chromaRgb) return image;

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return image;

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  applyChromaKey(imageData, chromaRgb);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

/**
 * canvas.width = canvas.width 的目的不是改尺寸，
 * 而是故意触发一次「重置画布」，相当于不换大小地换一块新 bitmap。
 */
const resetBitmap = (canvas: HTMLCanvasElement) => {
  // eslint-disable-next-line no-self-assign
  canvas.width = canvas.width;
};

export class SpritePlayer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly spritesheet: CanvasImageSource;
  private readonly atlas: SpritePlayerOptions['atlas'];
  private readonly frameIntervalMs: number;
  private disposed = false;

  private frameIndex = 0;
  private elapsedMs = 0;
  private animation: PetAnimation | null = null;
  private loop = true;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private onComplete: (() => void) | null = null;
  private rafId = 0;
  private lastTimestamp = 0;
  private playing = false;
  /** Bumped on every playback switch to ignore stale rAF callbacks. */
  private playbackToken = 0;
  private scale: number;

  constructor({
    canvas,
    spritesheet,
    atlas,
    scale = 1,
    frameIntervalMs = DEFAULT_ANIMATION_TICK_MS,
    chromaKey
  }: SpritePlayerOptions) {
    canvasOwner.get(canvas)?.dispose();

    this.canvas = canvas;
    this.atlas = atlas;
    this.scale = scale;
    this.frameIntervalMs = frameIntervalMs;
    this.spritesheet = prepareSpritesheet(
      spritesheet,
      chromaKey ? parseHexColor(chromaKey) : null
    );

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.ctx = ctx;

    this.applyCanvasDimensions(scale);

    canvasOwner.set(canvas, this);
    this.wipeDisplay();
  }

  private applyCanvasDimensions(scale: number) {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.round(this.atlas.cellWidth * scale);
    const displayHeight = Math.round(this.atlas.cellHeight * scale);
    const pixelWidth = Math.ceil(displayWidth * dpr);
    const pixelHeight = Math.ceil(displayHeight * dpr);
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
  }

  /** Stop rAF, drop callbacks, invalidate stale ticks — does not clear the canvas. */
  private interruptPlayback() {
    this.stopLoop();
    this.onComplete = null;
    this.playbackToken += 1;
    this.playing = false;
    this.rangeFrom = null;
    this.rangeTo = null;
  }

  private beginPlayback(
    animation: PetAnimation,
    options: {
      startFrame: number;
      rangeFrom?: number;
      rangeTo?: number;
      loop: boolean;
      onComplete: (() => void) | null;
    },
    hardSwitch = false
  ) {
    if (this.disposed) return;

    this.interruptPlayback();

    this.animation = animation;
    this.frameIndex = options.startFrame;
    this.rangeFrom = options.rangeFrom ?? null;
    this.rangeTo = options.rangeTo ?? null;
    this.loop = options.loop;
    this.onComplete = options.onComplete;

    this.playing = true;
    this.lastTimestamp = 0;
    this.elapsedMs = 0;

    this.paintFrame(hardSwitch);
    this.scheduleTick(this.playbackToken);
  }

  private scheduleTick(token: number) {
    this.rafId = requestAnimationFrame(timestamp => {
      this.tick(timestamp, token);
    });
  }

  private isActivePlayback(token: number) {
    return (
      !this.disposed &&
      token === this.playbackToken &&
      this.playing &&
      this.animation != null
    );
  }

  private stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = (timestamp: number, token: number) => {
    if (!this.isActivePlayback(token)) return;

    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.elapsedMs += delta;

    let frameAdvanced = false;
    const frameDuration = this.frameIntervalMs;
    while (this.elapsedMs >= frameDuration) {
      if (!this.isActivePlayback(token)) return;

      this.elapsedMs -= frameDuration;
      this.advanceFrame();
      frameAdvanced = true;

      if (!this.isActivePlayback(token)) return;
    }

    if (frameAdvanced) {
      this.renderFrame(token);
    }

    if (!this.isActivePlayback(token)) return;

    this.scheduleTick(token);
  };

  private advanceFrame() {
    if (!this.animation) return;

    if (this.rangeFrom != null && this.rangeTo != null) {
      const next = this.frameIndex + 1;
      if (next > this.rangeTo) {
        if (this.loop) {
          this.frameIndex = this.rangeFrom;
        } else {
          this.finish();
        }
      } else {
        this.frameIndex = next;
      }
      return;
    }

    const next = this.frameIndex + 1;
    if (next >= this.animation.frames) {
      if (this.loop) {
        this.frameIndex = 0;
      } else {
        this.frameIndex = this.animation.frames - 1;
        this.finish();
      }
      return;
    }

    this.frameIndex = next;
  }

  private finish() {
    this.stopLoop();

    const done = this.onComplete;

    this.onComplete = null;
    this.playbackToken += 1;
    this.playing = false;
    this.rangeFrom = null;
    this.rangeTo = null;

    done?.();
  }

  /** Reset GPU bitmap and clear all pixels (WebKit-safe). */
  private wipeDisplay() {
    resetBitmap(this.canvas);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderFrame(token: number) {
    if (!this.isActivePlayback(token) || !this.animation) return;

    this.paintFrame(false);
  }

  /**
   * Wipe then draw the current frame.
   * WebKit on macOS keeps prior pixels in transparent areas unless the display
   * canvas is fully replaced each frame via `copy` compositing (clearRect alone
   * is not enough after switching from a larger pose such as idle → failed).
   */
  private paintFrame(hardSwitch: boolean) {
    if (!this.animation) return;

    const { width, height } = this.canvas;
    if (hardSwitch) {
      resetBitmap(this.canvas);
    }

    const { cellWidth, cellHeight } = this.atlas;
    const col = this.frameIndex;
    const row = this.animation.row;
    const sx = col * cellWidth;
    const sy = row * cellHeight;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalCompositeOperation = 'copy';
    this.ctx.fillStyle = 'rgba(0,0,0,0)';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.spritesheet,
      sx,
      sy,
      cellWidth,
      cellHeight,
      0,
      0,
      width,
      height
    );
    this.ctx.globalCompositeOperation = 'source-over';
    requestTransparentRepaint();
  }

  /** Cancel in-flight playback (used when interrupting from outside). */
  protected cancelPlayback() {
    this.interruptPlayback();
  }

  public getScale(): number {
    return this.scale;
  }

  /** Resize display canvas and redraw the current frame. */
  public setScale(scale: number, hardSwitch = true) {
    if (this.disposed) return;

    this.scale = scale;
    this.applyCanvasDimensions(scale);

    if (this.animation) {
      this.paintFrame(hardSwitch);
    }
  }

  /** Tear down rAF loop; safe to call multiple times. */
  public dispose() {
    if (this.disposed) return;

    this.disposed = true;
    this.interruptPlayback();
    this.animation = null;
    if (canvasOwner.get(this.canvas) === this) {
      canvasOwner.delete(this.canvas);
    }
    this.wipeDisplay();
  }

  /** Start full animation from frame 0. */
  public play(animation: PetAnimation, options: PlayOptions = {}) {
    this.beginPlayback(
      animation,
      {
        startFrame: 0,
        loop: options.loop ?? animation.loop ?? true,
        onComplete: options.onComplete ?? null
      },
      options.hardSwitch ?? false
    );
  }

  /** Play an inclusive frame sub-range (0-based indices). */
  public playRange(animation: PetAnimation, options: PlayRangeOptions) {
    const { fromFrame, toFrame } = options;
    if (fromFrame > toFrame) {
      throw new Error(`Invalid frame range: ${fromFrame}..${toFrame}`);
    }

    this.beginPlayback(
      animation,
      {
        startFrame: fromFrame,
        rangeFrom: fromFrame,
        rangeTo: toFrame,
        loop: options.loop ?? false,
        onComplete: options.onComplete ?? null
      },
      options.hardSwitch ?? false
    );
  }

  /** Draw a single frame without advancing the timeline. */
  public showFrame(animation: PetAnimation, frameIndex: number) {
    this.interruptPlayback();
    this.animation = animation;
    this.rangeFrom = null;
    this.rangeTo = null;
    this.frameIndex =
      ((frameIndex % animation.frames) + animation.frames) % animation.frames;
    this.paintFrame(true);
  }

  /** Redraw the current frame (e.g. after the window regains focus). */
  public refreshDisplay(hardSwitch = true) {
    if (!this.animation) return;

    this.paintFrame(hardSwitch);
  }

  /** Stop playback, drop callbacks, and clear the canvas. */
  public stop() {
    this.interruptPlayback();
    this.animation = null;
    this.wipeDisplay();
  }
}
