import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { hasPetPackage, listDeployablePets } from '../lib/list-pets.mjs';

test('hasPetPackage is true when pet.json exists', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pet-skins-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const petDir = join(root, 'demo');
  await mkdir(petDir, { recursive: true });
  await writeFile(join(petDir, 'pet.json'), '{"id":"demo"}', 'utf8');

  assert.equal(await hasPetPackage(petDir), true);
  assert.equal(await hasPetPackage(root), false);
});

test('listDeployablePets skips scripts/ and dirs without pet.json', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pet-skins-list-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, 'scripts'), { recursive: true });
  await mkdir(join(root, 'empty-dir'), { recursive: true });

  const wing = join(root, 'sugarwing');
  await mkdir(wing, { recursive: true });
  await writeFile(join(wing, 'pet.json'), '{"id":"sugarwing"}', 'utf8');

  const pets = await listDeployablePets(root);
  assert.deepEqual(
    pets.map(p => p.name),
    ['sugarwing']
  );
});
