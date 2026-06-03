import { describe, expect, it } from 'vitest';

import { parseAipetTextAction, parseAipetCommand } from '../src/pet/protocol';
import { parseTextSource } from '../src/pet/text-source';

describe('parseTextSource', () => {
  it('accepts known tools and rejects unknown', () => {
    expect(parseTextSource('cursor')).toBe('cursor');
    expect(parseTextSource('QCODE')).toBe('qcode');
    expect(parseTextSource('vscode')).toBeNull();
    expect(parseTextSource('')).toBeNull();
  });
});

describe('parseAipetTextAction', () => {
  it('dismisses all when search is empty', () => {
    expect(parseAipetTextAction('aipet://text')).toEqual({ type: 'dismiss' });
  });

  it('dismisses one sid when only sid is set', () => {
    expect(parseAipetTextAction('aipet://text?sid=sess-1')).toEqual({
      type: 'dismiss',
      sid: 'sess-1'
    });
  });

  it('defaults sid but omits reply without sty', () => {
    const action = parseAipetTextAction('aipet://text?txt=hello');
    expect(action?.type).toBe('show');
    if (action?.type !== 'show') {
      return;
    }
    expect(action.message.sid).toBe('default');
    expect(action.message.reply).toBeUndefined();
    expect(action.message.text).toBe('hello');
  });

  it('enables reply when sid and sty are set', () => {
    const action = parseAipetTextAction(
      'aipet://text?sid=sess-9&sty=cursor&txt=hi'
    );
    expect(action?.type).toBe('show');
    if (action?.type !== 'show') {
      return;
    }
    expect(action.message.reply).toEqual({
      sty: 'cursor',
      sid: 'sess-9'
    });
  });

  it('accepts legacy stp alias for reply', () => {
    const action = parseAipetTextAction(
      'aipet://text?sid=sess-9&stp=claude&txt=hi'
    );
    if (action?.type !== 'show') {
      throw new Error('expected show action');
    }
    expect(action.message.reply).toEqual({
      sty: 'claude',
      sid: 'sess-9'
    });
  });

  it('omits reply when sid present but sty invalid', () => {
    const action = parseAipetTextAction(
      'aipet://text?sid=sess-9&sty=unknown&txt=hi'
    );
    if (action?.type !== 'show') {
      throw new Error('expected show action');
    }
    expect(action.message.reply).toBeUndefined();
  });
});

describe('parseAipetCommand', () => {
  it('parses animation keys', () => {
    expect(parseAipetCommand('aipet://base')).toEqual({ type: 'base' });
    const waving = parseAipetCommand('aipet://waving?count=2');
    expect(waving).toEqual({
      type: 'animation',
      state: 'waving',
      loop: true,
      count: 2,
      defaultMode: false
    });
  });
});
