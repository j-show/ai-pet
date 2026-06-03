import { sendToolReply } from '../config/tool-reply';

import type { AipetTextMessage, TextIcon } from './text-message';
import type { TextReplyTarget, TextSource } from './text-source';

export type { AipetTextMessage, TextIcon, TextReplyTarget, TextSource };
export { DEFAULT_TEXT_SID } from './text-message';

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

const SEND_ARROW_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" transform="rotate(-90 12 12)"></path></svg>`;

/** One speech bubble DOM subtree. */
class TextBubbleItem {
  private readonly closeEl: HTMLButtonElement;
  private readonly replyEl: HTMLButtonElement;
  private readonly headerEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly iconEl: HTMLElement;
  private readonly contentEl: HTMLElement;
  private visible = false;
  private replyTarget: TextReplyTarget | null = null;

  constructor(
    public readonly root: HTMLElement,
    onDismiss: () => void,
    private readonly onReplyClick: (
      anchor: HTMLElement,
      target: TextReplyTarget
    ) => void
  ) {
    this.closeEl = root.querySelector(
      '.text-bubble__close'
    ) as HTMLButtonElement;
    this.replyEl = root.querySelector(
      '.text-bubble__reply'
    ) as HTMLButtonElement;
    this.headerEl = root.querySelector('.text-bubble__header') as HTMLElement;
    this.titleEl = root.querySelector('.text-bubble__title') as HTMLElement;
    this.contentEl = root.querySelector('.text-bubble__content') as HTMLElement;
    this.iconEl = root.querySelector('.text-bubble__icon') as HTMLElement;

    this.closeEl.addEventListener('click', event => {
      event.stopPropagation();
      onDismiss();
    });

    this.replyEl.addEventListener('click', event => {
      event.stopPropagation();
      if (!this.replyTarget) return;
      this.onReplyClick(this.root, this.replyTarget);
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

    this.replyTarget = message.reply ?? null;
    this.root.classList.toggle(
      'text-bubble--replyable',
      Boolean(this.replyTarget)
    );
    this.replyEl.hidden = !this.replyTarget;

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
    this.replyTarget = null;
    this.replyEl.hidden = true;
    this.root.classList.remove('text-bubble--replyable');
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
    <button type="button" class="text-bubble__reply" hidden>回复</button>
  `;
  return root;
};

class TextBubbleComposer {
  private readonly inputEl: HTMLTextAreaElement;
  private readonly sendEl: HTMLButtonElement;
  private target: TextReplyTarget | null = null;
  private sending = false;

  constructor(protected readonly root: HTMLElement) {
    this.inputEl = root.querySelector(
      '.text-bubble-composer__input'
    ) as HTMLTextAreaElement;
    this.sendEl = root.querySelector(
      '.text-bubble-composer__send'
    ) as HTMLButtonElement;

    this.sendEl.addEventListener('click', () => {
      void this.submit();
    });

    this.inputEl.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void this.submit();
      }
      if (event.key === 'Escape') {
        this.close();
      }
    });

    document.addEventListener('pointerdown', event => {
      if (this.root.hidden) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (this.root.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest('.text-bubble__reply, .text-bubble')
      ) {
        return;
      }
      this.close();
    });
  }

  public open(anchor: HTMLElement, target: TextReplyTarget) {
    this.target = target;
    this.inputEl.value = '';
    this.sendEl.disabled = false;
    this.root.hidden = false;

    const rect = anchor.getBoundingClientRect();
    this.root.style.left = `${Math.max(8, rect.right - 220)}px`;
    this.root.style.top = `${rect.bottom + 6}px`;

    this.inputEl.focus();
  }

  public close() {
    this.target = null;
    this.root.hidden = true;
    this.inputEl.value = '';
  }

  public isOpenFor(target: TextReplyTarget) {
    return (
      !this.root.hidden &&
      this.target?.sid === target.sid &&
      this.target?.sty === target.sty
    );
  }

  private async submit() {
    if (this.sending || !this.target) return;

    const text = this.inputEl.value.trim();
    if (!text) return;

    this.sending = true;
    this.sendEl.disabled = true;

    try {
      await sendToolReply(this.target.sty, this.target.sid, text);
      this.close();
    } catch (error) {
      console.warn('[ai-pet] tool reply failed:', error);
      this.sendEl.disabled = false;
    } finally {
      this.sending = false;
    }
  }
}

/** Multiple speech bubbles stacked downward; same sid replaces content in place. */
export class TextBubbleStack {
  private readonly entries = new Map<string, TextBubbleItem>();
  private readonly order: string[] = [];
  private readonly composer: TextBubbleComposer;

  constructor(
    private readonly container: HTMLElement,
    private readonly onDismiss?: () => void
  ) {
    const composerRoot = document.createElement('div');
    composerRoot.className = 'text-bubble-composer';
    composerRoot.hidden = true;
    composerRoot.innerHTML = `
      <textarea class="text-bubble-composer__input" rows="2" placeholder="回复" aria-label="回复内容"></textarea>
      <button type="button" class="text-bubble-composer__send" aria-label="发送">${SEND_ARROW_SVG}</button>
    `;
    const mount = container.parentElement ?? document.body;
    mount.appendChild(composerRoot);
    this.composer = new TextBubbleComposer(composerRoot);
  }

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
      item = new TextBubbleItem(
        root,
        () => {
          this.dismiss(sid);
        },
        (anchor, replyTarget) => {
          if (this.composer.isOpenFor(replyTarget)) {
            this.composer.close();
            return;
          }
          this.composer.open(anchor, replyTarget);
        }
      );
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
