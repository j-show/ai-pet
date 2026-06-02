import { invoke } from '@tauri-apps/api/core';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { clampPetScale, envPetScale, savePetScale } from '../config/pet-scale';
import { loadTextPayload } from '../config/text-payload';
import { type UserEnv, DEFAULT_ANIMATION_TICK_MS } from '../config/user-env';
import {
  applyWindowTopRightAnchor,
  parseWindowAnchor,
  readWindowTopRightAnchor,
  saveWindowTopRightAnchor
} from '../config/window-position';

import { DEFAULT_PET_ID } from './codex-defaults';
import { loadPet } from './loader';
import { SpritePlayer } from './sprite-player';
import {
  TextBubbleStack,
  bubbleAnchorForPet,
  type AipetTextMessage
} from './text-bubble';
import type { LoadedPet, PetState } from './types';

const DRAG_THRESHOLD_PX = 6;
/** Opposite movement required before flipping run direction during drag loop. */
const DIRECTION_FLIP_PX = 10;
const TAP_MAX_MS = 350;
const IDLE_BEHAVIOR_MIN_MS = 25_000;
const IDLE_BEHAVIOR_MAX_MS = 55_000;
const IDLE_BEHAVIOR_STATES: PetState[] = ['jumping'];
const HOVER_JUMP_CYCLES = 3;

/** 1-based frames 1-2 → 0-based 0-1 */
const DRAG_START_FROM = 0;
const DRAG_START_TO = 1;
/** 1-based frames 3-6 → 0-based 2-5 */
const DRAG_LOOP_FROM = 2;
const DRAG_LOOP_TO = 5;
/** 1-based frames 7-8 → 0-based 6-7 */
const DRAG_END_FROM = 6;
const DRAG_END_TO = 7;

type DragPhase = 'none' | 'start' | 'loop' | 'end';

interface ScaleSession {
  /** Screen-space top-left of the pet; fixed for the whole drag. */
  anchorScreenX: number;
  anchorScreenY: number;
  /** `hypot(cellWidth, cellHeight)` — scale 1 reference diagonal. */
  baseDist: number;
  pointerId: number;
  changed: boolean;
}

interface DragSession {
  startWindowX: number | null;
  lastWindowX: number | null;
  moved: boolean;
  phase: DragPhase;
  direction: PetState | null;
  /** Accumulated px moved opposite to current run direction before flipping. */
  oppositeDragPx: number;
}

export class DesktopPet {
  private pet: LoadedPet | null = null;
  private player: SpritePlayer | null = null;
  private currentState: PetState = 'idle';
  private busy = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly canvasWrap: HTMLElement;
  private readonly scaleHandle: HTMLButtonElement;
  private readonly stageEl: HTMLElement;
  private readonly contextMenu: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly textBubbles: TextBubbleStack;

  private petScale = 1;
  private scaleSession: ScaleSession | null = null;
  private scaleDragRaf = 0;
  private pendingPetScale: number | null = null;
  private pointerDown: { x: number; y: number; time: number } | null = null;
  private activePointerId: number | null = null;
  private dragSession: DragSession | null = null;
  private dragReleasePollRaf = 0;
  private idleTimer = 0;
  /** Temporary base replacement set by `?default=true`; cleared by `aipet://base`. */
  private protocolDefault: PetState | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    canvasWrap: HTMLElement,
    scaleHandle: HTMLButtonElement,
    stageEl: HTMLElement,
    contextMenu: HTMLElement,
    titleEl: HTMLElement,
    textBubblesRoot: HTMLElement
  ) {
    this.canvas = canvas;
    this.canvasWrap = canvasWrap;
    this.scaleHandle = scaleHandle;
    this.stageEl = stageEl;
    this.contextMenu = contextMenu;
    this.titleEl = titleEl;
    this.textBubbles = new TextBubbleStack(textBubblesRoot, () => {
      void this.resizeWindow();
    });
  }

  private petDisplayWidth(): number {
    if (!this.pet) return 0;
    // Prefer DOM-measured size to avoid rounding/DPR drift during large scales.
    const rect = this.canvas.getBoundingClientRect();
    return rect.width > 0
      ? Math.round(rect.width)
      : Math.round(this.pet.atlas.cellWidth * this.petScale);
  }

  private petDisplayHeight(): number {
    if (!this.pet) return 0;
    // Prefer DOM-measured size to avoid rounding/DPR drift during large scales.
    const rect = this.canvas.getBoundingClientRect();
    return rect.height > 0
      ? Math.round(rect.height)
      : Math.round(this.pet.atlas.cellHeight * this.petScale);
  }

  private async resizeWindow() {
    if (!this.pet) {
      return;
    }

    try {
      const appWindow = getCurrentWindow();
      const petWidth = this.petDisplayWidth();
      const petHeight = this.petDisplayHeight();
      const anchor = bubbleAnchorForPet(petWidth, petHeight);

      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });

      if (this.textBubbles.isVisible()) {
        this.textBubbles.layoutAtAnchor(anchor);
      }

      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });

      let minX = 0;
      let minY = 0;
      let maxX = petWidth;
      let maxY = petHeight;

      const bubbleBox = this.textBubbles.measureBox(anchor);
      if (bubbleBox) {
        minX = Math.min(minX, bubbleBox.left);
        minY = Math.min(minY, bubbleBox.top);
        maxX = Math.max(maxX, bubbleBox.right);
        maxY = Math.max(maxY, bubbleBox.bottom);
      }

      const offsetX = -minX;
      const offsetY = -minY;
      this.stageEl.style.transform =
        offsetX === 0 && offsetY === 0
          ? ''
          : `translate(${offsetX}px, ${offsetY}px)`;

      let newWidth = maxX - minX;
      let newHeight = maxY - minY;

      // Ensure the window can also contain the context menu when open, otherwise
      // it gets clipped when the pet is scaled down to a tiny window.
      if (!this.contextMenu.hidden) {
        const menuRect = this.contextMenu.getBoundingClientRect();
        newWidth = Math.max(newWidth, Math.ceil(menuRect.right));
        newHeight = Math.max(newHeight, Math.ceil(menuRect.bottom));
        newWidth = Math.max(newWidth, Math.ceil(menuRect.width));
        newHeight = Math.max(newHeight, Math.ceil(menuRect.height));
      }

      const outerPos = await appWindow.outerPosition();
      const innerPos = await appWindow.innerPosition();
      const innerSize = await appWindow.innerSize();
      const chromeLeft = outerPos.x - innerPos.x;
      // Keep top-right inner corner fixed while expanding/shrinking the transparent window.
      const topRightInnerX = innerPos.x + innerSize.width;

      await appWindow.setSize(new LogicalSize(newWidth, newHeight));

      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const newInnerSize = await appWindow.innerSize();
      const newInnerLeft = topRightInnerX - newInnerSize.width;
      await appWindow.setPosition(
        new PhysicalPosition(newInnerLeft + chromeLeft, outerPos.y)
      );

      // After resizing, clamp the context menu so it stays inside the window.
      if (!this.contextMenu.hidden) {
        const size = await appWindow.innerSize();
        const menuRect = this.contextMenu.getBoundingClientRect();
        const maxLeft = Math.max(0, size.width - Math.ceil(menuRect.width));
        const maxTop = Math.max(0, size.height - Math.ceil(menuRect.height));
        const nextLeft = Math.min(
          Math.max(0, Math.round(menuRect.left)),
          maxLeft
        );
        const nextTop = Math.min(Math.max(0, Math.round(menuRect.top)), maxTop);
        this.contextMenu.style.left = `${nextLeft}px`;
        this.contextMenu.style.top = `${nextTop}px`;
      }
    } catch (error) {
      console.warn('Failed to resize window:', error);
    }
  }

  private async bindMoveListener() {
    const appWindow = getCurrentWindow();
    await appWindow.onMoved(({ payload: position }) => {
      this.onWindowMoved(position.x);
    });
  }

  private directionForDelta(dx: number): PetState {
    return dx < 0 ? 'running-left' : 'running-right';
  }

  private isRunningState(
    state: PetState | null
  ): state is 'running-left' | 'running-right' {
    return state === 'running-left' || state === 'running-right';
  }

  private trackOppositeDrag(step: number) {
    if (
      !this.dragSession ||
      this.dragSession.phase !== 'loop' ||
      !this.isRunningState(this.dragSession.direction) ||
      step === 0
    ) {
      return;
    }

    const facingRight = this.dragSession.direction === 'running-right';
    const opposite = facingRight ? step < 0 : step > 0;

    if (!opposite) {
      this.dragSession.oppositeDragPx = 0;
      return;
    }

    this.dragSession.oppositeDragPx += Math.abs(step);
    if (this.dragSession.oppositeDragPx < DIRECTION_FLIP_PX) {
      return;
    }

    const nextDirection: PetState = facingRight
      ? 'running-left'
      : 'running-right';
    this.dragSession.oppositeDragPx = 0;
    this.updateDragLoop(nextDirection);
  }

  private onWindowMoved(windowX: number) {
    if (!this.dragSession || !this.player || !this.pet) {
      return;
    }

    // Native window drag on Windows/Linux may clear pointer tracking early.
    if (this.dragSession.phase === 'none' && !this.pointerDown) {
      return;
    }

    if (this.dragSession.startWindowX === null) {
      this.dragSession.startWindowX = windowX;
      this.dragSession.lastWindowX = windowX;
      return;
    }

    const dx = windowX - this.dragSession.startWindowX;
    const step =
      this.dragSession.lastWindowX === null
        ? 0
        : windowX - this.dragSession.lastWindowX;
    this.dragSession.lastWindowX = windowX;

    if (Math.abs(dx) < DRAG_THRESHOLD_PX) {
      return;
    }

    this.dragSession.moved = true;
    this.clearIdleTimer();

    if (this.dragSession.phase === 'none') {
      this.beginDragStart(this.directionForDelta(dx));
      return;
    }

    if (this.dragSession.phase === 'loop') {
      this.trackOppositeDrag(step);
    }
  }

  private beginDragStart(direction: PetState) {
    if (!this.dragSession || !this.player || !this.pet) {
      return;
    }

    const animation = this.pet.animations.get(direction);
    if (!animation) {
      return;
    }

    this.dragSession.phase = 'start';
    this.dragSession.direction = direction;
    this.currentState = direction;
    this.startDragReleasePoll();

    this.player.playRange(animation, {
      fromFrame: DRAG_START_FROM,
      toFrame: DRAG_START_TO,
      loop: false,
      onComplete: () => {
        if (this.dragSession?.phase === 'start') {
          this.beginDragLoop(
            this.currentLoopDirection() ?? this.dragSession.direction ?? void 0
          );
        }
      }
    });
  }

  private beginDragLoop(direction?: PetState) {
    if (!this.dragSession || !this.player || !this.pet) {
      return;
    }

    if (
      this.dragSession.phase !== 'start' &&
      this.dragSession.phase !== 'loop'
    ) {
      return;
    }

    const resolvedDirection =
      direction ?? this.dragSession.direction ?? this.currentLoopDirection();
    if (!resolvedDirection) {
      return;
    }

    const animation = this.pet.animations.get(resolvedDirection);
    if (!animation) {
      return;
    }

    this.dragSession.phase = 'loop';
    this.dragSession.direction = resolvedDirection;
    this.dragSession.oppositeDragPx = 0;
    this.currentState = resolvedDirection;

    this.player.playRange(animation, {
      fromFrame: DRAG_LOOP_FROM,
      toFrame: DRAG_LOOP_TO,
      loop: true
    });
  }

  private currentLoopDirection(): PetState | null {
    if (
      !this.dragSession ||
      this.dragSession.startWindowX === null ||
      this.dragSession.lastWindowX === null
    ) {
      return null;
    }

    const dx = this.dragSession.lastWindowX - this.dragSession.startWindowX;
    if (Math.abs(dx) < DRAG_THRESHOLD_PX) {
      return null;
    }

    return this.directionForDelta(dx);
  }

  private updateDragLoop(direction: PetState) {
    if (!this.dragSession || this.dragSession.phase !== 'loop') {
      return;
    }

    if (this.dragSession.direction === direction) {
      return;
    }

    this.beginDragLoop(direction);
  }

  private beginDragEnd(direction: PetState) {
    if (!this.player || !this.pet) {
      this.restoreBase();
      return;
    }

    const animation = this.pet.animations.get(direction);
    if (!animation) {
      this.restoreBase();
      return;
    }

    if (this.dragSession) {
      this.dragSession.phase = 'end';
    }

    this.currentState = direction;
    this.player.playRange(animation, {
      fromFrame: DRAG_END_FROM,
      toFrame: DRAG_END_TO,
      loop: false,
      hardSwitch: true,
      onComplete: () => {
        this.restoreBase();
      }
    });
  }

  private shouldUseDragReleasePoll() {
    return (
      typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
    );
  }

  private stopDragReleasePoll() {
    if (this.dragReleasePollRaf) {
      cancelAnimationFrame(this.dragReleasePollRaf);
      this.dragReleasePollRaf = 0;
    }
  }

  /** Windows: `startDragging()` blocks pointerup; poll GetAsyncKeyState instead. */
  private startDragReleasePoll() {
    if (!this.shouldUseDragReleasePoll() || this.dragReleasePollRaf) {
      return;
    }

    const tick = () => {
      const session = this.dragSession;
      if (!session || (session.phase !== 'start' && session.phase !== 'loop')) {
        this.stopDragReleasePoll();
        return;
      }

      void invoke<boolean>('is_primary_mouse_button_down')
        .then(down => {
          if (
            !down &&
            this.dragSession &&
            (this.dragSession.phase === 'start' ||
              this.dragSession.phase === 'loop')
          ) {
            this.endActiveDrag();
          }
        })
        .catch(error => {
          console.warn('drag release poll failed:', error);
        });

      this.dragReleasePollRaf = requestAnimationFrame(tick);
    };

    this.dragReleasePollRaf = requestAnimationFrame(tick);
  }

  private cancelDragTracking() {
    this.stopDragReleasePoll();
    this.dragSession = null;
    this.pointerDown = null;
    this.activePointerId = null;
  }

  private endActiveDrag(): boolean {
    const session = this.dragSession;
    if (!session) {
      return false;
    }

    const direction = session.direction;
    const wasDrag =
      session.moved || session.phase === 'start' || session.phase === 'loop';

    this.cancelDragTracking();

    if (direction && wasDrag) {
      void this.persistWindowAnchorAfterDrag();
      this.beginDragEnd(direction);
      return true;
    }

    return false;
  }

  private async persistWindowAnchorAfterDrag() {
    try {
      const anchor = await readWindowTopRightAnchor();
      await saveWindowTopRightAnchor(anchor);
    } catch (error) {
      console.warn('Failed to save window position:', error);
    }
  }

  private async restoreWindowFromEnv(env: UserEnv) {
    const anchor = parseWindowAnchor(env);
    if (!anchor) {
      return;
    }

    try {
      await applyWindowTopRightAnchor(anchor);
    } catch (error) {
      console.warn('Failed to restore window position:', error);
    }
  }

  private finishPointerInteraction(event: PointerEvent | MouseEvent) {
    if (event.button !== 0 || !this.pointerDown) {
      return;
    }

    const pointerDown = this.pointerDown;
    const dx = event.screenX - pointerDown.x;
    const dy = event.screenY - pointerDown.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = Date.now() - pointerDown.time;

    if (this.endActiveDrag()) {
      return;
    }

    this.cancelDragTracking();

    if (
      distance < DRAG_THRESHOLD_PX &&
      elapsed < TAP_MAX_MS &&
      'detail' in event &&
      event.detail === 1
    ) {
      this.onTap();
    }
  }

  private onPointerUp = (event: PointerEvent) => {
    if (
      this.activePointerId !== null &&
      event.pointerId !== this.activePointerId
    ) {
      return;
    }

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    this.finishPointerInteraction(event);
  };

  private onWindowMouseUp = (event: MouseEvent) => {
    this.finishPointerInteraction(event);
  };

  private cancelScaleDragRaf() {
    if (this.scaleDragRaf) {
      cancelAnimationFrame(this.scaleDragRaf);
      this.scaleDragRaf = 0;
    }
  }

  private flushScaleDragFrame() {
    this.scaleDragRaf = 0;
    const next = this.pendingPetScale;
    this.pendingPetScale = null;
    if (next == null || next === this.petScale) {
      return;
    }

    this.petScale = next;
    this.player?.setScale(next, false);
  }

  private scheduleScaleDragUpdate(nextScale: number) {
    this.pendingPetScale = nextScale;
    if (this.scaleDragRaf) {
      return;
    }

    this.scaleDragRaf = requestAnimationFrame(() => {
      this.flushScaleDragFrame();
    });
  }

  private bindScaleHandle() {
    const onScalePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !this.pet) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = this.canvasWrap.getBoundingClientRect();
      const baseDist = Math.hypot(
        this.pet.atlas.cellWidth,
        this.pet.atlas.cellHeight
      );
      if (baseDist < 1) {
        return;
      }

      this.cancelScaleDragRaf();
      this.pendingPetScale = null;
      this.scaleSession = {
        anchorScreenX: rect.left,
        anchorScreenY: rect.top,
        baseDist,
        pointerId: event.pointerId,
        changed: false
      };

      try {
        this.scaleHandle.setPointerCapture(event.pointerId);
      } catch {
        // Fallback: window-level listeners still run.
      }
    };

    const onScalePointerMove = (event: PointerEvent) => {
      const session = this.scaleSession;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      const dist = Math.hypot(
        event.clientX - session.anchorScreenX,
        event.clientY - session.anchorScreenY
      );
      const nextScale = clampPetScale(dist / session.baseDist);
      if (nextScale === this.petScale && nextScale === this.pendingPetScale) {
        return;
      }

      session.changed = true;
      this.scheduleScaleDragUpdate(nextScale);
    };

    const finishScaleDrag = async (event: PointerEvent) => {
      const session = this.scaleSession;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      if (this.scaleHandle.hasPointerCapture(event.pointerId)) {
        this.scaleHandle.releasePointerCapture(event.pointerId);
      }

      this.cancelScaleDragRaf();
      if (this.pendingPetScale != null) {
        this.petScale = this.pendingPetScale;
        this.pendingPetScale = null;
      }

      const changed = session.changed;
      this.scaleSession = null;

      if (!changed) {
        return;
      }

      this.player?.setScale(this.petScale, true);

      try {
        await this.resizeWindow();
        await savePetScale(this.petScale);
      } catch (error) {
        console.warn('Failed to save pet scale:', error);
      }
    };

    this.scaleHandle.addEventListener('pointerdown', onScalePointerDown);
    this.scaleHandle.addEventListener('pointermove', onScalePointerMove);
    this.scaleHandle.addEventListener('pointerup', event => {
      void finishScaleDrag(event);
    });
    this.scaleHandle.addEventListener('pointercancel', event => {
      void finishScaleDrag(event);
    });
  }

  private bindEvents() {
    this.canvas.addEventListener('contextmenu', event => {
      event.preventDefault();
      this.showContextMenu(event.clientX, event.clientY);
    });

    this.canvasWrap.addEventListener('pointerenter', () => {
      // Idle doesn't count as "normal playback"; when user hovers, give a short
      // jumping greeting if nothing else is running.
      if (this.busy) return;
      if (this.currentState !== 'idle') return;
      if (this.activePointerId !== null) return;
      if (this.dragSession || this.scaleSession) return;

      this.clearIdleTimer();
      this.playProtocolCounted('jumping', HOVER_JUMP_CYCLES);
    });

    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) {
        return;
      }

      if (event.detail >= 2) {
        return;
      }

      this.hideContextMenu();
      this.activePointerId = event.pointerId;
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture may fail on unsupported platforms; window mouseup is fallback.
      }

      this.pointerDown = {
        x: event.screenX,
        y: event.screenY,
        time: Date.now()
      };
      this.dragSession = {
        startWindowX: null,
        lastWindowX: null,
        moved: false,
        phase: 'none',
        direction: null,
        oppositeDragPx: 0
      };

      void getCurrentWindow()
        .outerPosition()
        .then(({ x }) => {
          if (!this.dragSession) {
            return;
          }

          this.dragSession.startWindowX = x;
          this.dragSession.lastWindowX = x;
        });

      void getCurrentWindow().startDragging();
    });

    this.canvas.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('mouseup', this.onWindowMouseUp, true);

    // document.addEventListener('click', event => {
    //   if (
    //     !(event.target instanceof Node) ||
    //     !this.contextMenu.contains(event.target)
    //   ) {
    //     this.hideContextMenu();
    //   }
    // });

    this.contextMenu
      .querySelector("[data-action='quit']")
      ?.addEventListener('click', () => {
        void getCurrentWindow().close();
      });
  }

  /** Play a full animation cycle `cyclesLeft` times, then return to base/default. */
  private playProtocolCounted(
    state: PetState,
    cyclesLeft: number,
    hardSwitch = true
  ) {
    const animation = this.pet?.animations.get(state);
    if (!this.player || !animation) {
      return;
    }

    this.busy = true;
    this.currentState = state;
    this.player.play(animation, {
      loop: false,
      hardSwitch,
      onComplete: () => {
        if (cyclesLeft <= 1) {
          this.busy = false;
          this.restoreBase();
          return;
        }

        this.playProtocolCounted(state, cyclesLeft - 1, false);
      }
    });
  }

  /**
   * Return to standby: loop temporary default if set, otherwise normal auto-play.
   */
  private restoreBase() {
    if (this.protocolDefault) {
      this.clearIdleTimer();
      this.playDefaultLoop(this.protocolDefault, true);
      return;
    }

    this.enterAutoPlay();
  }

  /** Loop a state; used for temporary default base override (always loops). */
  private playDefaultLoop(state: PetState, hardSwitch = false) {
    const animation = this.pet?.animations.get(state);
    if (!this.player || !animation) {
      return;
    }

    this.busy = false;
    this.currentState = state;
    this.player.play(animation, { loop: true, hardSwitch });
  }

  private onTap() {
    if (this.busy) {
      return;
    }

    this.playOnce('waving');
  }

  private playState(state: PetState, hardSwitch = false) {
    const animation = this.pet?.animations.get(state);
    if (!this.player || !animation) {
      return;
    }

    this.currentState = state;
    this.player.play(animation, { loop: animation.loop ?? true, hardSwitch });
  }

  private playOnce(state: PetState, hardSwitch = false) {
    const animation = this.pet?.animations.get(state);
    if (!this.player || !animation) {
      return;
    }

    this.busy = true;
    this.currentState = state;
    this.player.play(animation, {
      loop: false,
      hardSwitch,
      onComplete: () => {
        this.busy = false;
        this.restoreBase();
      }
    });
  }

  private clearIdleTimer() {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = 0;
  }

  private scheduleIdleBehavior() {
    if (this.protocolDefault) {
      return;
    }

    this.clearIdleTimer();
    const delay =
      IDLE_BEHAVIOR_MIN_MS +
      Math.random() * (IDLE_BEHAVIOR_MAX_MS - IDLE_BEHAVIOR_MIN_MS);

    this.idleTimer = window.setTimeout(() => {
      if (this.busy || this.currentState !== 'idle') {
        this.scheduleIdleBehavior();
        return;
      }

      const state =
        IDLE_BEHAVIOR_STATES[
          Math.floor(Math.random() * IDLE_BEHAVIOR_STATES.length)
        ];
      this.playOnce(state);
    }, delay);
  }

  private showContextMenu(x: number, y: number) {
    this.contextMenu.hidden = false;
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    void this.resizeWindow();
  }

  private hideContextMenu() {
    this.contextMenu.hidden = true;
    void this.resizeWindow();
  }

  /** Handle `aipet://{key}?loop=&count=&default=` protocol requests. */
  public playProtocolAnimation(
    state: PetState,
    loop: boolean,
    count: number | null = null,
    defaultMode = false
  ) {
    const animation = this.pet?.animations.get(state);
    if (!this.player || !animation) {
      return;
    }

    this.clearIdleTimer();
    this.dragSession = null;
    this.pointerDown = null;
    this.player.stop();

    if (defaultMode) {
      this.protocolDefault = state;
    }

    if (count !== null) {
      this.playProtocolCounted(state, count);
      return;
    }

    if (loop || defaultMode) {
      this.playDefaultLoop(state, true);
      return;
    }

    this.playOnce(state, true);
  }

  /** Return to `aipet://base` idle auto-play; clears temporary default override. */
  public enterAutoPlay() {
    this.protocolDefault = null;
    this.clearIdleTimer();
    this.busy = false;
    this.dragSession = null;
    this.pointerDown = null;
    this.playState('idle', true);
    this.scheduleIdleBehavior();
  }

  /** Handle `aipet://text?sid=&icon=&txt=` protocol requests. */
  public async showProtocolText(message: AipetTextMessage) {
    const fromFile = await loadTextPayload(message.sid);
    const enriched: AipetTextMessage = {
      sid: message.sid,
      title: message.title || fromFile?.title || void 0,
      text: fromFile?.text || message.text || '',
      icon: message.icon ?? null
    };
    this.textBubbles.show(enriched);
    void this.resizeWindow();
  }

  /** Handle `aipet://text` or `aipet://text?sid=` to dismiss bubble(s). */
  public dismissProtocolText(sid?: string) {
    this.textBubbles.dismiss(sid);
  }

  public async init(
    petId = DEFAULT_PET_ID,
    animationTickMs = DEFAULT_ANIMATION_TICK_MS,
    userEnv: UserEnv = {}
  ) {
    const { pet, spritesheet } = await loadPet(petId);
    this.pet = pet;
    this.petScale = envPetScale(userEnv);
    this.titleEl.textContent = pet.manifest.displayName;
    document.title = pet.manifest.displayName;

    this.player?.dispose();
    this.player = new SpritePlayer({
      canvas: this.canvas,
      spritesheet,
      atlas: pet.atlas,
      scale: this.petScale,
      frameIntervalMs: animationTickMs,
      chromaKey: pet.manifest.chromaKey
    });

    this.bindEvents();
    this.bindScaleHandle();
    await this.bindMoveListener();
    this.enterAutoPlay();
    await this.resizeWindow();
    await this.restoreWindowFromEnv(userEnv);
  }

  public refreshDisplay() {
    this.player?.refreshDisplay(true);
  }

  /** Release animation loop and idle timers (HMR / re-init). */
  public destroy() {
    this.clearIdleTimer();
    this.stopDragReleasePoll();
    this.cancelScaleDragRaf();
    this.protocolDefault = null;
    this.player?.dispose();
    this.player = null;
    this.dragSession = null;
    this.scaleSession = null;
    this.pointerDown = null;
    this.activePointerId = null;
  }
}
