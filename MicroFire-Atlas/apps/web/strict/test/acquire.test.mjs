import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fetchJson } from '../src/acquire/safe.mjs';

// Temporary cache and fixture folders, so the test never writes into cache/ or demo_fixtures/. OFFLINE=1 keeps it off the network.
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'flamescope-acquire-'));
  const cacheDir = join(root, 'cache'), fixtureDir = join(root, 'fixtures');
  mkdirSync(cacheDir); mkdirSync(fixtureDir);
  return { cacheDir, fixtureDir, done: () => rmSync(root, { recursive: true, force: true }) };
}
async function offline(fn) {
  const saved = process.env.OFFLINE; process.env.OFFLINE = '1';
  try { return await fn(); } finally { if (saved === undefined) delete process.env.OFFLINE; else process.env.OFFLINE = saved; }
}

test('a corrupt cache file falls back to the committed fixture instead of failing', () => offline(async () => {
  const s = sandbox();
  try {
    writeFileSync(join(s.cacheDir, 'thing.json'), '{"half": ');                 // e.g. a download cut off mid-write
    writeFileSync(join(s.fixtureDir, 'thing.json'), JSON.stringify({ title: 'fixture copy' }));
    const r = await fetchJson('https://example.invalid/thing', { name: 'thing', cacheDir: s.cacheDir, fixtureDir: s.fixtureDir });
    assert.deepEqual(r, { data: { title: 'fixture copy' }, source: 'fixture' });

    writeFileSync(join(s.cacheDir, 'thing.json'), JSON.stringify({ title: 'cached copy' }));
    assert.deepEqual(await fetchJson('https://example.invalid/thing', { name: 'thing', cacheDir: s.cacheDir, fixtureDir: s.fixtureDir }),
      { data: { title: 'cached copy' }, source: 'cache' }, 'a good cache still wins over the fixture');

    writeFileSync(join(s.cacheDir, 'thing.json'), 'not json'); writeFileSync(join(s.fixtureDir, 'thing.json'), 'also not json');
    await assert.rejects(fetchJson('https://example.invalid/thing', { name: 'thing', cacheDir: s.cacheDir, fixtureDir: s.fixtureDir }), /No usable live, cache or fixture data for thing/);
  } finally { s.done(); }
}));
