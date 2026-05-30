export type TextIcon = 'warn' | 'error' | 'info';

export interface AipetTextMessage {
  title?: string;
  text: string;
  icon: TextIcon | null;
}

export interface TextBubbleAnchor {
  x: number;
  y: number;
}

/** Horizontal center of the pet sprite. */
export const BUBBLE_ANCHOR_X_RATIO = 0.7;
/** Lower-middle area of the pet sprite (feet/belly region). */
export const BUBBLE_ANCHOR_Y_RATIO = 1;

const ICON_LABELS: Record<TextIcon, string> = {
  warn: '!',
  error: '×',
  info: 'i'
};

export function bubbleAnchorForPet(
  petWidth: number,
  petHeight: number
): TextBubbleAnchor {
  return {
    x: Math.round(petWidth * BUBBLE_ANCHOR_X_RATIO),
    y: Math.round(petHeight * BUBBLE_ANCHOR_Y_RATIO)
  };
}

/** Speech bubble anchored to the pet sprite; drives window resize via optional callback. */
export class TextBubble {
  private visible = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly closeEl: HTMLButtonElement,
    private readonly headerEl: HTMLElement,
    private readonly titleEl: HTMLElement,
    private readonly iconEl: HTMLElement,
    private readonly contentEl: HTMLElement,
    private readonly onDismiss?: () => void
  ) {
    this.closeEl.addEventListener('click', event => {
      event.stopPropagation();
      this.dismiss();
    });
  }

  private playEnterAnimation() {
    this.root.classList.remove('text-bubble--visible');
    void this.root.offsetWidth;
    this.root.classList.add('text-bubble--visible');
  }

  /** Show message; empty title+text hides the bubble. */
  public show(message: AipetTextMessage) {
    const title = message.title?.trim() ?? '';
    const text = message.text ?? '';

    if (!title && !text) {
      this.hide();
      return;
    }

    if (title) {
      this.titleEl.textContent = title;
      this.titleEl.hidden = false;
    } else {
      this.titleEl.textContent = '';
      this.titleEl.hidden = true;
    }

    if (text) {
      this.contentEl.textContent = text;
      this.contentEl.hidden = false;
    } else {
      this.contentEl.textContent = '';
      this.contentEl.hidden = true;
    }

    this.iconEl.className = 'text-bubble__icon';
    if (message.icon) {
      this.iconEl.hidden = false;
      this.iconEl.textContent = ICON_LABELS[message.icon];
      this.iconEl.classList.add(`text-bubble__icon--${message.icon}`);
    } else {
      this.iconEl.hidden = true;
      this.iconEl.textContent = '';
    }

    const hasHeader = Boolean(title) || Boolean(message.icon);
    this.headerEl.hidden = !hasHeader;
    this.headerEl.classList.toggle(
      'text-bubble__header--icon-only',
      !title && Boolean(message.icon)
    );
    this.root.classList.toggle(
      'text-bubble--title-only',
      Boolean(title && !text)
    );

    this.root.hidden = false;
    this.closeEl.hidden = false;
    this.visible = true;
    this.playEnterAnimation();
  }

  /** Hide bubble and notify listener (typically to shrink the window). */
  public dismiss() {
    if (!this.visible) {
      return;
    }

    this.hide();
    this.onDismiss?.();
  }

  public hide() {
    this.root.hidden = true;
    this.root.style.left = '';
    this.root.style.top = '';
    this.root.classList.remove(
      'text-bubble--title-only',
      'text-bubble--visible'
    );
    this.headerEl.classList.remove('text-bubble__header--icon-only');
    this.closeEl.hidden = true;
    this.visible = false;
    this.headerEl.hidden = true;
    this.titleEl.hidden = true;
    this.titleEl.textContent = '';
    this.contentEl.hidden = true;
    this.contentEl.textContent = '';
    this.iconEl.hidden = true;
    this.iconEl.textContent = '';
    this.iconEl.className = 'text-bubble__icon';
  }

  /** Place bubble top-right corner at the anchor point. */
  public layoutAtAnchor(anchor: TextBubbleAnchor) {
    this.root.style.left = `${anchor.x}px`;
    this.root.style.top = `${anchor.y}px`;
  }

  public isVisible() {
    return this.visible;
  }

  /** Bounding box in stage coordinates (top-right anchor at `anchor`). */
  public measureBox(anchor: TextBubbleAnchor) {
    if (!this.visible) {
      return null;
    }

    const width = this.root.offsetWidth;
    const height = this.root.offsetHeight;
    const left = anchor.x - width;
    const top = anchor.y;
    const right = anchor.x;
    const bottom = anchor.y + height;

    return { left, top, right, bottom, width, height };
  }
}
