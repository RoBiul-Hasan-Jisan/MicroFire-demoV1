import test from 'node:test';
import assert from 'node:assert/strict';
import { ask } from '../src/compute/scenario.mjs';
import { records } from '../src/compute/evidence.mjs';
import { fabricTests } from '../src/compute/sets.mjs';
import { paramsFrom, applyPatch } from '../web/state.js';

const failed = r => r.checks.filter(c => !c.ok).map(c => c.key);
const check = (r, key) => r.checks.find(c => c.key === key);
// Expected IDs below are read by hand from data/bass-table.csv and data/bass-fabric.csv (Tables 5.1 and 7.1).

test('audit case A: 1 mm, 16.8% O₂ and 21 cm/s were never recorded together, so no test supports it', () => {
  const r = ask({ q: 'Will a 1 mm acrylic sheet burn on the ISS at 16.8% oxygen with 21 cm/s airflow?' });
  assert.equal(r.verdict.state, 'no-data');
  assert.equal(r.evidence, null); assert.equal(r.findings, null); assert.equal(r.why, null);
  assert.deepEqual(failed(r), ['together']);
  assert.deepEqual(r.applicability.matched, []);
  // Each condition on its own was recorded, by different tests: M1/M6/M7/M16 are 1 mm, only M18 passed 16.8%, only M11 ran at 21 cm/s.
  const together = r.gaps.find(g => g.topic === 'Together').text;
  for (const clause of ['1 mm sheets: M1, M6, M7 and M16.', '16.8% oxygen: M18.', '21 cm/s: M11.']) assert.ok(together.includes(clause), clause);
  assert.ok(r.closest.tests.length > 0 && r.closest.tests.every(t => t.conditions.some(c => !c.ok)), 'closest tests stay visible, each with what it misses');
  const m1 = r.closest.tests.find(t => t.id === 'M1');
  assert.deepEqual(m1.conditions.map(c => [c.key, c.ok, c.recorded]), [['oxygen', false, '22.2% → 21.9%'], ['airflow', false, '9 cm/s'], ['thickness', true, '1 mm']]);
});

test('audit case B: SIBAL at 21% O₂ and 53 cm/s is not supported by GMT178-T17, which ran at 16.9%', () => {
  const r = ask({ q: 'Will SIBAL burn on the ISS at 21% oxygen with 53 cm/s airflow?' });
  assert.equal(r.verdict.state, 'no-data'); assert.deepEqual(failed(r), ['together']);
  const t17 = r.closest.tests.find(t => t.id === 'GMT178-T17');
  assert.deepEqual(t17.conditions.map(c => [c.key, c.ok, c.recorded]), [['oxygen', false, '16.9%'], ['airflow', true, '6 to 53 cm/s']]);
  assert.deepEqual(r.closest.tests.map(t => t.id).sort(), ['GMT131-T10', 'GMT178-T17', 'GMT222-T11', 'GMT96-T7', 'GMT96-T8']);
});

test('supported combinations still get an answer, built only from the rows that record them', () => {
  const r = ask({ q: 'Will a 1 mm acrylic sheet burn at 10 cm/s?' });
  assert.equal(r.verdict.state, 'burned'); assert.equal(r.verdict.count, '2 of 2 matching tests');
  assert.deepEqual(r.evidence.ids, ['M6', 'M7']);
  assert.deepEqual(r.evidence.readings.map(p => [p.id, p.velocity, p.spread]), [['M6', 10, null], ['M7', 10, 0.106]]);
  assert.equal(r.evidence.stats.fastest.spread, 0.106); assert.equal(r.evidence.stats.notTracked, 1);

  const o2 = ask({ q: 'Will acrylic burn on the ISS at 21% oxygen?' });
  assert.equal(o2.verdict.state, 'burned');
  assert.deepEqual(o2.evidence.ids, ['M4', 'M5', 'M6', 'M12', 'M15'], 'tests whose start-to-end oxygen passed through 21%');
  assert.match(o2.evidence.caveat, /passed through 21% at some point during its burn/);

  const fabric = ask({ q: 'Will SIBAL burn at 21% oxygen?' });
  assert.equal(fabric.verdict.state, 'burned'); assert.deepEqual(fabric.evidence.ids, ['GMT96-T8', 'GMT96-T7', 'GMT131-T10', 'GMT222-T11']);
});

test('oxygen endpoints are never tied to one airflow reading within an acrylic test', () => {
  const r = ask({ q: 'Will acrylic burn at 19% oxygen with 5 cm/s airflow?' });
  assert.equal(r.verdict.state, 'no-data'); assert.deepEqual(failed(r), ['together']);
  assert.match(r.verdict.headline, /can’t tie an oxygen level to one airflow reading/);
  // M8, M13 and M16 each ran at 5 cm/s and passed through 19%, but the table can't say both happened at once.
  assert.deepEqual(r.closest.tests.filter(t => t.untied).map(t => t.id), ['M8', 'M13', 'M16']);
});

test('corpus bounds are context, never a match: an airflow between set values is not interpolated', () => {
  const r = ask({ q: 'Will acrylic burn at 7 cm/s?' });
  assert.equal(r.verdict.state, 'no-data', '7 cm/s lies inside 2–21 cm/s, but no test was set to it');
  assert.equal(r.verdict.headline, 'Unknown. No test ran at exactly 7 cm/s.');
  assert.match(r.gaps.find(g => g.topic === 'Airflow').text, /6 cm\/s \(M7, M8, M13 and M19\) and 8 cm\/s \(M6 and M18\)/);

  const fabric = ask({ q: 'Will SIBAL burn at 17% oxygen?' });
  assert.equal(fabric.verdict.headline, 'Unknown. No test recorded exactly 17% oxygen.');
  assert.match(fabric.gaps[0].text, /The nearest were 16\.9% and 17\.1%/);
});

test('missing pressure is never a measured match, and a different pressure is a gap', () => {
  const base = ask({ q: 'Will acrylic burn on the ISS?' });
  assert.equal(base.verdict.state, 'burned'); assert.equal(base.evidence.ids.length, 20);
  assert.deepEqual([check(base, 'pressure').status, check(base, 'pressure').ok, check(base, 'pressure').statusLabel], ['unrecorded', true, 'Not recorded']);
  assert.deepEqual([check(base, 'oxygen').status, check(base, 'oxygen').statusLabel], ['context', 'Station air']);
  assert.ok(base.checks.every(c => !(c.key === 'pressure' && c.status === 'match')));
  assert.equal(ask({ q: 'acrylic at 1 atm' }).verdict.state, 'burned', '1 atm is the station’s nominal pressure');
  const other = ask({ q: 'Will acrylic burn at 14.5 psi?' });
  assert.equal(other.verdict.state, 'no-data'); assert.equal(other.verdict.headline, 'Unknown. No test here is documented at 14.5 psi.');
});

test('fabric outcomes are read at the requested airflow', () => {
  // GMT45-T4 and GMT100-T13 both went out as their flow was turned down to 2.2 cm/s.
  const r = ask({ q: 'Will SIBAL fabric burn at 2.2 cm/s?' });
  assert.equal(r.verdict.state, 'no-burn'); assert.deepEqual(r.evidence.ids, ['GMT45-T4', 'GMT100-T13']);
  assert.equal(r.verdict.headline, 'No flame held at 2.2 cm/s in NASA’s 2 tries.');
  assert.deepEqual(r.evidence.tests.map(t => t.atYourAirflow), ['Went out as the airflow reached this speed', 'Went out as the airflow reached this speed']);
  const quenchedRows = fabricTests.filter(t => r.evidence.ids.includes(t.id)).map(t => t.outcome);
  assert.deepEqual(quenchedRows, ['quenched', 'quenched']);
});

test('the nearest-evidence button lands on matching tests for every kind of gap', () => {
  const questions = [
    'Will a 1 mm acrylic sheet burn on the ISS at 16.8% oxygen with 21 cm/s airflow?',
    'Will SIBAL burn on the ISS at 21% oxygen with 53 cm/s airflow?',
    'Will acrylic burn at 7 cm/s?', 'Will acrylic burn at 19% oxygen with 5 cm/s airflow?', 'Will SIBAL burn at 17% oxygen?',
    'Will acrylic burn on the ISS at 100 psi?', 'Will acrylic burn on Earth?', 'Will steel burn on the ISS?', 'Will acrylic burn at 25 °C?',
    'Will a 10 mm sheet burn at 30% oxygen?', 'Nomex at 10 cm/s'
  ];
  for (const q of questions) {
    const r = ask({ q });
    assert.equal(r.verdict.state, 'no-data', q);
    assert.ok(r.gaps.length && r.gaps.every(g => g.source.url.startsWith('https://')), q);
    // The page sends the scenario back as explicit params with the nearest-evidence patch applied (web/state.js).
    const next = ask(applyPatch(paramsFrom(r.scenario), r.nearest.params));
    assert.notEqual(next.verdict.state, 'no-data', `${q} → ${r.nearest.changes}`);
  }
});

test('mission tile badges count the same joint matches as the answer', () => {
  const r = ask({ q: 'Will a 1 mm acrylic sheet burn at 10 cm/s?' });
  assert.deepEqual(r.missions.map(m => [m.id, m.matches]), [['iss', 2], ['moon', 0], ['transit', 2], ['mars', 0]]);
  const all = records.filter(x => x.thicknessMm === 1 && x.velocity.includes(10)).map(x => x.id);
  assert.deepEqual(all, r.evidence.ids);
});
