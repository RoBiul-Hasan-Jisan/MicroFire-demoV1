import test from 'node:test';
import assert from 'node:assert/strict';
import { ask, parseQuestion, ENVELOPE, InputError } from '../src/compute/scenario.mjs';
import { records } from '../src/compute/evidence.mjs';
import { createServer } from '../src/api/server.mjs';

const failed = r => r.checks.filter(c => !c.ok).map(c => c.key);

test('envelope is derived from the 20 BASS-II rows, not typed in', () => {
  assert.equal(ENVELOPE.o2Min, 16.8); assert.equal(ENVELOPE.o2Max, 22.2);
  assert.equal(ENVELOPE.flowMin, 2); assert.equal(ENVELOPE.flowMax, 21);
  assert.deepEqual(ENVELOPE.thicknesses, [1, 2, 3, 4, 5]);
});

test('every suggested question is read the way the UI promises', () => {
  const iss = ask({ q: 'Will acrylic burn on the ISS?' });
  assert.equal(iss.scenario.mission.id, 'iss'); assert.equal(iss.verdict.state, 'burned'); assert.equal(iss.evidence.ids.length, 20);

  const moon = ask({ q: 'Will it burn on a Moon base at 34% oxygen?' });
  assert.equal(moon.scenario.mission.id, 'moon'); assert.equal(moon.scenario.air.key, 'exploration');
  assert.deepEqual(failed(moon), ['gravity', 'oxygen', 'pressure']); assert.equal(moon.evidence, null);
  assert.match(moon.verdict.headline, /lunar gravity/);

  const transit = ask({ q: 'What about Mars transit in exploration air?' });
  assert.equal(transit.scenario.mission.id, 'transit'); assert.deepEqual(failed(transit), ['oxygen', 'pressure']);
  assert.match(transit.verdict.headline, /22\.2% oxygen/);

  const thick = ask({ q: 'Does a 1 mm sheet burn faster than 5 mm?' });
  assert.equal(thick.scenario.thickness, null); assert.match(thick.evidence.finding.text, /3× faster/);

  const still = ask({ q: 'Will a 1 mm acrylic sheet burn in still air?' });
  assert.equal(still.scenario.airflow, 0); assert.equal(still.scenario.thickness, 1); assert.deepEqual(failed(still), ['airflow']);

  const nomex = ask({ q: 'Is Nomex safe on a Mars base?' });
  assert.equal(nomex.scenario.material.id, 'nomex'); assert.equal(failed(nomex)[0], 'gravity'); assert.equal(nomex.verdict.state, 'no-data');
  assert.ok(nomex.notices.some(n => /can’t certify/.test(n)));
});

test('parser reads units, synonyms and ambiguity honestly', () => {
  assert.deepEqual(parseQuestion('plexiglass at 56.5 kPa').fields, { psi: 8.2, material: 'pmma' });
  assert.equal(parseQuestion('on the way to Mars').fields.mission, 'transit');
  assert.equal(parseQuestion('on Mars').fields.mission, 'mars');
  assert.equal(parseQuestion('at 12 cm/s').fields.airflow, 12);
  assert.equal(parseQuestion('a thin panel').fields.thickness, 1);
  const two = parseQuestion('moon or mars?');
  assert.equal(two.fields.mission, 'moon'); assert.match(two.notices[0], /more than one place/);
  assert.match(parseQuestion('hello there').notices[0], /defaults are shown/);
});

test('tapped controls beat the question, and the question beats defaults', () => {
  const r = ask({ q: 'moon base', mission: 'iss' });
  assert.equal(r.scenario.mission.id, 'iss');
  assert.equal(r.understood.find(u => u.field === 'Mission').from, 'picked');
  assert.equal(ask({ q: 'moon base' }).understood.find(u => u.field === 'Mission').from, 'question');
  assert.equal(ask({}).understood.find(u => u.field === 'Mission').from, 'default');
  assert.equal(ask({ mission: 'moon' }).scenario.air.key, 'exploration');
  assert.equal(ask({ mission: 'moon', air: 'earth' }).scenario.air.key, 'earth');
  assert.equal(ask({ o2: 30, psi: 10 }).scenario.air.key, 'custom');
});

test('evidence numbers trace back to the table rows', () => {
  const r = ask({ thickness: 1 });
  const rows = records.filter(x => x.thicknessMm === 1);
  assert.deepEqual(r.evidence.ids, rows.map(x => x.id));
  assert.equal(r.evidence.stats.fastest.spread, Math.max(...rows.flatMap(x => x.spread || [])));
  assert.equal(r.evidence.stats.notTracked, rows.filter(x => !x.spread).length);
  const f = r.evidence.stats.fastest, row = records.find(x => x.id === f.id);
  assert.equal(row.velocity[row.spread.indexOf(f.spread)], f.velocity);
});

test('gaps cite a source, and the nearest-evidence button really lands on evidence', () => {
  for (const q of ['Nomex on a Moon base', 'Mars transit in exploration air', 'still air', 'a 10 mm sheet']) {
    const r = ask({ q });
    assert.equal(r.verdict.state, 'no-data', q);
    assert.ok(r.gaps.length && r.gaps.every(g => g.source.url.startsWith('https://')), q);
    const s = r.scenario;
    const next = ask({ mission: s.mission.id, material: s.material.id, thickness: s.thickness ?? 'all', airflow: s.airflow ?? 'none', air: s.air.key, ...r.nearest.params });
    assert.notEqual(next.verdict.state, 'no-data', q);   // lands on evidence: Burned, Mixed or No flame held
  }
});

test('cited claims match their sources, as checked on 2026-09-24 (docs/planning/datasets.md §4)', () => {
  const moon = ask({ mission: 'moon' }), text = moon.gaps.map(g => g.text).join(' ');
  assert.match(text, /about 10 psi and 26% O₂ on V, and about 8 psi and 29–31% O₂ on VI/);
  assert.doesNotMatch(text, /8\.2 psi and 34% O₂ inside/);
  assert.match(text, /more than 25 seconds in simulated lunar gravity/); assert.doesNotMatch(text, /five seconds/);
  assert.match(text, /For acrylic rods, early drop-tower centrifuge results put lunar gravity near the worst case/);
  const cites = moon.gaps.map(g => g.source.url);
  for (const id of ['20250010653', '20240002981', '20150021491']) assert.ok(cites.some(u => u.includes(id)), id);
  assert.ok(!cites.some(u => /216134/.test(u)));
  assert.equal(ask({}).why.text, 'Related BASS-II tests kept acrylic rods burning at 17% O₂ in orbit. On the ground, rods of the same sizes couldn’t keep a flame at 18% or below.');
});

test('invalid input is refused, not guessed', () => {
  assert.throws(() => ask({ mission: 'pluto' }), InputError);
  assert.throws(() => ask({ air: 'vacuum' }), InputError);
  assert.throws(() => ask({ thickness: 'thick' }), InputError);
  assert.throws(() => ask({ q: 'x'.repeat(501) }), InputError);
});

test('API serves /api/ask and the Will It Burn page', async () => {
  const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const ok = await (await fetch(base + '/api/ask?q=' + encodeURIComponent('Will acrylic burn on the ISS?'))).json();
    assert.equal(ok.verdict.state, 'burned');
    assert.equal((await fetch(base + '/api/ask?mission=pluto')).status, 400);
    const page = await fetch(base + '/');
    assert.equal(page.status, 200); assert.match(await page.text(), /Will it burn/);
    assert.equal((await fetch(base + '/app.js')).status, 200);
    for (const old of ['/burn', '/burn/']) {
      const moved = await fetch(base + old, { redirect: 'manual' });
      assert.equal(moved.status, 301); assert.equal(moved.headers.get('location'), '/');
    }
  } finally { await new Promise(r => server.close(r)); }
});
