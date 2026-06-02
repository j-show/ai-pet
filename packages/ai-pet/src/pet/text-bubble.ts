export type TextIcon = 'warn' | 'error' | 'info' | 'loading';

export interface AipetTextMessage {
  /** Session id; same sid updates in place, different sids stack vertically. */
  sid: string;
  title?: string;
  text: string;
  icon: TextIcon | null;
}

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

/** Horizontal center of the pet sprite. */
export const BUBBLE_ANCHOR_X_RATIO = 0.7;
/** Lower-middle area of the pet sprite (feet/belly region). */
export const BUBBLE_ANCHOR_Y_RATIO = 1;
export const DEFAULT_TEXT_SID = 'default';
const BUBBLE_STACK_GAP_PX = 8;

const ICON_LABELS: Record<Exclude<TextIcon, 'loading'>, string> = {
  warn: '!',
  error: '×',
  info: 'i'
};

export const bubbleAnchorForPet = (
  petWidth: number,
  petHeight: number
): TextBubbleAnchor => {
  return {
    x: Math.round(petWidth * BUBBLE_ANCHOR_X_RATIO),
    y: Math.round(petHeight * BUBBLE_ANCHOR_Y_RATIO)
  };
};

/** One speech bubble DOM subtree. */
class TextBubbleItem {
  private readonly closeEl: HTMLButtonElement;
  private readonly headerEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly iconEl: HTMLElement;
  private readonly contentEl: HTMLElement;
  private visible = false;

  constructor(
    public readonly root: HTMLElement,
    onDismiss: () => void
  ) {
    this.closeEl = root.querySelector(
      '.text-bubble__close'
    ) as HTMLButtonElement;
    this.headerEl = root.querySelector('.text-bubble__header') as HTMLElement;
    this.titleEl = root.querySelector('.text-bubble__title') as HTMLElement;
    this.contentEl = root.querySelector('.text-bubble__content') as HTMLElement;
    this.iconEl = root.querySelector('.text-bubble__icon') as HTMLElement;

    this.closeEl.addEventListener('click', event => {
      event.stopPropagation();
      onDismiss();
    });
  }

  private playEnterAnimation() {
    this.root.classList.remove('text-bubble--visible');
    void this.root.offsetWidth;
    this.root.classList.add('text-bubble--visible');
  }

  public show(message: AipetTextMessage) {
    const title = message.title?.trim() ?? '';
    const text = message.text ?? '';

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
      this.iconEl.classList.remove('text-bubble__icon--none');
      this.iconEl.classList.add(`text-bubble__icon--${message.icon}`);
      if (message.icon === 'loading') {
        this.iconEl.textContent = '';
        this.iconEl.removeAttribute('aria-hidden');
        this.iconEl.setAttribute('role', 'status');
        this.iconEl.setAttribute('aria-label', '加载中');
      } else {
        this.iconEl.textContent = ICON_LABELS[message.icon];
        this.iconEl.setAttribute('aria-hidden', 'true');
        this.iconEl.removeAttribute('role');
        this.iconEl.removeAttribute('aria-label');
      }
    } else {
      this.iconEl.hidden = true;
      this.iconEl.classList.add(`text-bubble__icon--none`);
      this.iconEl.textContent = '';
      this.iconEl.setAttribute('aria-hidden', 'true');
      this.iconEl.removeAttribute('role');
      this.iconEl.removeAttribute('aria-label');
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
    this.iconEl.setAttribute('aria-hidden', 'true');
    this.iconEl.removeAttribute('role');
    this.iconEl.removeAttribute('aria-label');
  }

  public layoutAt(anchorX: number, topY: number) {
    this.root.style.left = `${anchorX}px`;
    this.root.style.top = `${topY}px`;
  }

  public isVisible() {
    return this.visible;
  }

  public measureBox(anchorX: number, topY: number): TextBubbleBox {
    const width = this.root.offsetWidth;
    const height = this.root.offsetHeight;
    const left = anchorX - width;
    const top = topY;
    return {
      left,
      top,
      right: anchorX,
      bottom: topY + height,
      width,
      height
    };
  }
}

const createTextBubbleElement = (sid: string): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'text-bubble';
  root.dataset.sid = sid;
  root.hidden = true;
  root.innerHTML = `
    <button type="button" class="text-bubble__close" aria-label="关闭" hidden>×</button>
    <div class="text-bubble__header" hidden>
      <p class="text-bubble__title" hidden></p>
      <span class="text-bubble__icon" hidden aria-hidden="true"></span>
    </div>
    <p class="text-bubble__content" hidden></p>
  `;
  return root;
};

/** Multiple speech bubbles stacked downward; same sid replaces content in place. */
export class TextBubbleStack {
  private readonly entries = new Map<string, TextBubbleItem>();
  private readonly order: string[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly onDismiss?: () => void
  ) {}

  private removeEntry(sid: string) {
    const item = this.entries.get(sid);
    if (!item) {
      return;
    }

    item.hide();
    item.root.remove();
    this.entries.delete(sid);
    const index = this.order.indexOf(sid);
    if (index >= 0) {
      this.order.splice(index, 1);
    }
  }

  public show(message: AipetTextMessage) {
    const sid = message.sid;
    const title = message.title?.trim() ?? '';
    const text = message.text ?? '';

    if (!title && !text && !message.icon) {
      this.dismiss(sid);
      return;
    }

    let item = this.entries.get(sid);
    if (!item) {
      const root = createTextBubbleElement(sid);
      this.container.appendChild(root);
      item = new TextBubbleItem(root, () => {
        this.dismiss(sid);
      });
      this.entries.set(sid, item);
      this.order.push(sid);
    }

    item.show(message);
  }

  public dismiss(sid?: string) {
    if (sid == null) {
      for (const id of [...this.order]) {
        this.removeEntry(id);
      }
      this.onDismiss?.();
      return;
    }

    if (!this.entries.has(sid)) {
      return;
    }

    this.removeEntry(sid);
    this.onDismiss?.();
  }

  public layoutAtAnchor(anchor: TextBubbleAnchor) {
    let topY = anchor.y;
    for (const sid of this.order) {
      const item = this.entries.get(sid);
      if (!item?.isVisible()) {
        continue;
      }

      item.layoutAt(anchor.x, topY);
      topY += item.root!.offsetHeight + BUBBLE_STACK_GAP_PX;
    }
  }

  public isVisible() {
    return this.order.some(sid => this.entries.get(sid)?.isVisible());
  }

  public measureBox(anchor: TextBubbleAnchor): TextBubbleBox | null {
    if (!this.isVisible()) {
      return null;
    }

    let minX = anchor.x;
    let minY = anchor.y;
    let maxX = anchor.x;
    let maxY = anchor.y;
    let topY = anchor.y;

    for (const sid of this.order) {
      const item = this.entries.get(sid);
      if (!item?.isVisible()) {
        continue;
      }

      const box = item.measureBox(anchor.x, topY);
      minX = Math.min(minX, box.left);
      minY = Math.min(minY, box.top);
      maxX = Math.max(maxX, box.right);
      maxY = Math.max(maxY, box.bottom);
      topY += box.height + BUBBLE_STACK_GAP_PX;
    }

    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}

/** @deprecated Use TextBubbleStack */
export type TextBubble = TextBubbleStack;
