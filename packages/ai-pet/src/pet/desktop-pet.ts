import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { DEFAULT_ANIMATION_TICK_MS } from '../config/user-env';

import { DEFAULT_PET_ID } from './codex-defaults';
import { loadPet } from './loader';
import { SpritePlayer } from './sprite-player';
import {
  TextBubble,
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
  private readonly stageEl: HTMLElement;
  private readonly contextMenu: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly textBubble: TextBubble;

  private pointerDown: { x: number; y: number; time: number } | null = null;
  private dragSession: DragSession | null = null;
  private idleTimer = 0;
  /** Temporary base replacement set by `?default=true`; cleared by `aipet://base`. */
  private protocolDefault: PetState | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    stageEl: HTMLElement,
    contextMenu: HTMLElement,
    titleEl: HTMLElement,
    textBubbleRoot: HTMLElement,
    textBubbleClose: HTMLButtonElement,
    textBubbleHeader: HTMLElement,
    textBubbleTitle: HTMLElement,
    textBubbleIcon: HTMLElement,
    textBubbleContent: HTMLElement
  ) {
    this.canvas = canvas;
    this.stageEl = stageEl;
    this.contextMenu = contextMenu;
    this.titleEl = titleEl;
    this.textBubble = new TextBubble(
      textBubbleRoot,
      textBubbleClose,
      textBubbleHeader,
      textBubbleTitle,
      textBubbleIcon,
      textBubbleContent,
      () => {
        void this.resizeWindow();
      }
    );
  }

  private async resizeWindow() {
    if (!this.pet) {
      return;
    }

    try {
      const appWindow = getCurrentWindow();
      const petWidth = this.pet.atlas.cellWidth;
      const petHeight = this.pet.atlas.cellHeight;
      const anchor = bubbleAnchorForPet(petWidth, petHeight);

      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });

      if (this.textBubble.isVisible()) {
        this.textBubble.layoutAtAnchor(anchor);
      }

      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });

      let minX = 0;
      let minY = 0;
      let maxX = petWidth;
      let maxY = petHeight;

      const bubbleBox = this.textBubble.measureBox(anchor);
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

      const newWidth = maxX - minX;
      const newHeight = maxY - minY;

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
    if (!this.pointerDown || !this.dragSession || !this.player || !this.pet) {
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

    this.player.playRange(animation, {
      fromFrame: DRAG_START_FROM,
      toFrame: DRAG_START_TO,
      loop: false,
      onComplete: () => {
        if (this.pointerDown && this.dragSession?.phase === 'start') {
          this.beginDragLoop(
            this.currentLoopDirection() ?? this.dragSession.direction ?? void 0
          );
        }
      }
    });
  }

  private beginDragLoop(direction?: PetState) {
    if (!this.pointerDown || !this.dragSession || !this.player || !this.pet) {
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
      onComplete: () => {
        this.restoreBase();
      }
    });
  }

  private bindEvents() {
    this.canvas.addEventListener('contextmenu', event => {
      event.preventDefault();
      this.showContextMenu(event.clientX, event.clientY);
    });

    this.canvas.addEventListener('mousedown', event => {
      if (event.button !== 0) {
        return;
      }

      if (event.detail >= 2) {
        return;
      }

      this.hideContextMenu();
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

      void getCurrentWindow().startDragging();
    });

    this.canvas.addEventListener('mouseup', event => {
      if (event.button !== 0 || !this.pointerDown) {
        return;
      }

      const dragDirection = this.dragSession?.direction ?? null;
      const wasDrag = this.dragSession?.moved ?? false;
      const dx = event.screenX - this.pointerDown.x;
      const dy = event.screenY - this.pointerDown.y;
      const distance = Math.hypot(dx, dy);
      const elapsed = Date.now() - this.pointerDown.time;

      this.dragSession = null;
      this.pointerDown = null;

      if (wasDrag && dragDirection) {
        this.beginDragEnd(dragDirection);
        return;
      }

      if (
        distance < DRAG_THRESHOLD_PX &&
        elapsed < TAP_MAX_MS &&
        event.detail === 1
      ) {
        this.onTap();
      }
    });

    document.addEventListener('click', event => {
      if (
        !(event.target instanceof Node) ||
        !this.contextMenu.contains(event.target)
      ) {
        this.hideContextMenu();
      }
    });

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
  }

  private hideContextMenu() {
    this.contextMenu.hidden = true;
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

  /** Handle `aipet://text?icon=&txt=` protocol requests. */
  public showProtocolText(message: AipetTextMessage) {
    this.textBubble.show(message);
    void this.resizeWindow();
  }

  /** Handle bare `aipet://text` to dismiss the text bubble. */
  public dismissProtocolText() {
    this.textBubble.dismiss();
  }

  public async init(
    petId = DEFAULT_PET_ID,
    animationTickMs = DEFAULT_ANIMATION_TICK_MS
  ) {
    const { pet, spritesheet } = await loadPet(petId);
    this.pet = pet;
    this.titleEl.textContent = pet.manifest.displayName;
    document.title = pet.manifest.displayName;

    this.player?.dispose();
    this.player = new SpritePlayer({
      canvas: this.canvas,
      spritesheet,
      atlas: pet.atlas,
      scale: 1,
      frameIntervalMs: animationTickMs,
      chromaKey: pet.manifest.chromaKey
    });

    this.bindEvents();
    await this.bindMoveListener();
    this.enterAutoPlay();
    await this.resizeWindow();
  }

  public refreshDisplay() {
    this.player?.refreshDisplay(true);
  }

  /** Release animation loop and idle timers (HMR / re-init). */
  public destroy() {
    this.clearIdleTimer();
    this.protocolDefault = null;
    this.player?.dispose();
    this.player = null;
    this.dragSession = null;
    this.pointerDown = null;
  }
}
