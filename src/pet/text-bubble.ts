import {
  BUBBLE_ANCHOR_X_RATIO,
  BUBBLE_ANCHOR_Y_RATIO
} from '../constants/text-bubble';

import type { AipetTextMessage } from './text-message';

export type { AipetTextMessage, TextIcon } from './text-message';
export type { TextReplyTarget, TextSource } from './text-source';
export { BUBBLE_STACK_GAP_PX } from '../constants/text-bubble';
export { DEFAULT_TEXT_SID } from '../constants/text';

export interface TextBubbleAnchor {
  x: number;
  y: number;
}

export interface TextBubbleBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export const bubbleAnchorForPet = (
  petWidth: number,
  petHeight: number
): TextBubbleAnchor => {
  return {
    x: Math.round(petWidth * BUBBLE_ANCHOR_X_RATIO),
    y: Math.round(petHeight * BUBBLE_ANCHOR_Y_RATIO)
  };
};

/** Imperative API implemented by `TextBubbles.vue` for window layout. */
export interface TextBubblesController {
  show(message: AipetTextMessage): void;
  dismiss(sid?: string): void;
  layoutAtAnchor(anchor: TextBubbleAnchor): void;
  isVisible(): boolean;
  measureBox(anchor: TextBubbleAnchor): TextBubbleBox | null;
}

/** @deprecated Use TextBubblesController */
export type TextBubble = TextBubblesController;

/** @deprecated Use TextBubblesController */
export type TextBubbleStack = TextBubblesController;
