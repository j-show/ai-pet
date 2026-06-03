import { describe, expect, it, vi } from 'vitest';

import { TEXT_ICON_VALUES } from '../src/constants/protocol';
import { parseAipetTextAction, parseAipetCommand } from '../src/pet/protocol';
import type { AipetTextMessage } from '../src/pet/text-message';
import { parseTextSource } from '../src/pet/text-source';

const expectShowMessage = (
  url: string,
  expected: Partial<AipetTextMessage> & Pick<AipetTextMessage, 'sid' | 'text'>
) => {
  const action = parseAipetTextAction(url);
  expect(action?.type).toBe('show');
  if (action?.type !== 'show') {
    return;
  }

  const { reply, title, icon, ...rest } = expected;
  expect(action.message).toMatchObject({
    icon: icon ?? null,
    ...rest
  });

  if ('reply' in expected) {
    expect(action.message.reply).toEqual(reply);
  } else {
    expect(action.message.reply).toBeUndefined();
  }

  if ('title' in expected) {
    expect(action.message.title).toBe(title);
  } else {
    expect(action.message.title).toBeUndefined();
  }
};

describe('parseTextSource', () => {
  it('accepts known tools case-insensitively', () => {
    expect(parseTextSource('cursor')).toBe('cursor');
    expect(parseTextSource('QCODE')).toBe('qcode');
  });

  it('returns null for unknown or empty source', () => {
    expect(parseTextSource('vscode')).toBeNull();
    expect(parseTextSource('')).toBeNull();
    expect(parseTextSource(null)).toBeNull();
  });
});

describe('parseAipetTextAction', () => {
  it('dismisses all when query is empty', () => {
    expect(parseAipetTextAction('aipet://text')).toEqual({ type: 'dismiss' });
  });

  it('dismisses one sid when only sid is set', () => {
    expect(parseAipetTextAction('aipet://text?sid=sess-1')).toEqual({
      type: 'dismiss',
      sid: 'sess-1'
    });
  });

  it('shows message with default sid when txt is set without sid', () => {
    expectShowMessage('aipet://text?txt=hello', {
      sid: 'default',
      text: 'hello'
    });
  });

  it('enables reply when sid and sty are both valid', () => {
    expectShowMessage('aipet://text?sid=sess-9&sty=cursor&txt=hi', {
      sid: 'sess-9',
      reply: { sty: 'cursor', sid: 'sess-9' },
      text: 'hi'
    });
  });

  it('accepts legacy stp alias for reply source', () => {
    expectShowMessage('aipet://text?sid=sess-9&stp=claude&txt=hi', {
      sid: 'sess-9',
      reply: { sty: 'claude', sid: 'sess-9' },
      text: 'hi'
    });
  });

  it('omits reply when sty is unknown', () => {
    expectShowMessage('aipet://text?sid=sess-9&sty=unknown&txt=hi', {
      sid: 'sess-9',
      text: 'hi'
    });
  });

  it.each(TEXT_ICON_VALUES)('parses icon=%s', icon => {
    expectShowMessage(`aipet://text?icon=${icon}&txt=body`, {
      sid: 'default',
      icon,
      text: 'body'
    });
  });

  it('shows bubble when only icon is set (does not dismiss)', () => {
    expectShowMessage('aipet://text?icon=info', {
      sid: 'default',
      icon: 'info',
      text: ''
    });
  });

  it('returns null icon for unknown icon values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expectShowMessage('aipet://text?icon=unknown&txt=x', {
      sid: 'default',
      icon: null,
      text: 'x'
    });
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it('decodes tl and txt query parameters', () => {
    expectShowMessage('aipet://text?tl=Hi%20there&txt=line%0Atwo', {
      sid: 'default',
      title: 'Hi there',
      text: 'line\ntwo'
    });
  });

  it('returns null for non-text aipet URLs', () => {
    expect(parseAipetTextAction('aipet://waving')).toBeNull();
    expect(parseAipetTextAction('https://example.com')).toBeNull();
  });
});

describe('parseAipetCommand', () => {
  it('parses base command', () => {
    expect(parseAipetCommand('aipet://base')).toEqual({ type: 'base' });
  });

  it('parses animation with count', () => {
    expect(parseAipetCommand('aipet://waving?count=2')).toEqual({
      type: 'animation',
      state: 'waving',
      loop: true,
      count: 2,
      defaultMode: false
    });
  });

  it('honors loop=false and default=true', () => {
    expect(
      parseAipetCommand('aipet://jumping?loop=false&default=true')
    ).toEqual({
      type: 'animation',
      state: 'jumping',
      loop: true,
      count: null,
      defaultMode: true
    });
  });

  it('maps runing typo alias to running state', () => {
    expect(parseAipetCommand('aipet://runing')).toEqual({
      type: 'animation',
      state: 'running',
      loop: true,
      count: null,
      defaultMode: false
    });
  });

  it('returns null for text key and unknown keys', () => {
    expect(parseAipetCommand('aipet://text')).toBeNull();
    expect(parseAipetCommand('aipet://unknown')).toBeNull();
  });
});
