import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  parseAipetTextAction,
  parseAipetCommand
} from '../src/pet/protocol.ts';
import { parseTextSource } from '../src/pet/text-source.ts';

test('parseTextSource accepts known tools and rejects unknown', () => {
  assert.equal(parseTextSource('cursor'), 'cursor');
  assert.equal(parseTextSource('QCODE'), 'qcode');
  assert.equal(parseTextSource('vscode'), null);
  assert.equal(parseTextSource(''), null);
});

test('parseAipetTextAction dismisses all when search is empty', () => {
  assert.deepEqual(parseAipetTextAction('aipet://text'), { type: 'dismiss' });
});

test('parseAipetTextAction dismisses one sid when only sid is set', () => {
  assert.deepEqual(parseAipetTextAction('aipet://text?sid=sess-1'), {
    type: 'dismiss',
    sid: 'sess-1'
  });
});

test('parseAipetTextAction defaults sid but omits reply without sty', () => {
  const action = parseAipetTextAction('aipet://text?txt=hello');
  assert.equal(action?.type, 'show');
  assert.equal(action.message.sid, 'default');
  assert.equal(action?.message.reply, void 0);
  assert.equal(action.message.text, 'hello');
});

test('parseAipetTextAction enables reply when sid and sty are set', () => {
  const action = parseAipetTextAction(
    'aipet://text?sid=sess-9&sty=cursor&txt=hi'
  );
  assert.equal(action?.type, 'show');
  assert.deepEqual(action.message.reply, { sty: 'cursor', sid: 'sess-9' });
});

test('parseAipetTextAction accepts legacy stp alias for reply', () => {
  const action = parseAipetTextAction(
    'aipet://text?sid=sess-9&stp=claude&txt=hi'
  );
  assert.deepEqual(action.message.reply, { sty: 'claude', sid: 'sess-9' });
});

test('parseAipetTextAction omits reply when sid present but sty invalid', () => {
  const action = parseAipetTextAction(
    'aipet://text?sid=sess-9&sty=unknown&txt=hi'
  );
  assert.equal(action?.message.reply, void 0);
});

test('parseAipetCommand parses animation keys', () => {
  assert.deepEqual(parseAipetCommand('aipet://base'), { type: 'base' });
  const waving = parseAipetCommand('aipet://waving?count=2');
  assert.equal(waving?.type, 'animation');
  assert.equal(waving.state, 'waving');
  assert.equal(waving.count, 2);
});
