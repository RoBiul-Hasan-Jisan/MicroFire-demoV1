import test from 'node:test';
import assert from 'node:assert/strict';
import { FINDINGS, rankFindings, tierFor } from '../src/compute/findings.mjs';
import { records } from '../src/compute/evidence.mjs';
import { ask } from '../src/compute/scenario.mjs';
import { createServer } from '../src/api/server.mjs';

test('findings are ranked by the documented rule, from the 20 rows', () => {
  assert.equal(FINDINGS.tests, 20);
  assert.deepEqual(FINDINGS.ranked.map(f => [f.rank, f.key, f.tier, f.agree, f.comparisons]), [
    [1, 'airflow', 'consistent', 29, 30], [2, 'thickness', 'consistent', 23, 26], [3, 'width', 'suggestive', 3, 4],
    [4, 'oxygen', 'too-few', 2, 2], [5, 'sides', 'too-few', 0, 1]]);
  assert.equal(tierFor(10, 9), 'consistent'); assert.equal(tierFor(10, 8), 'suggestive');
  assert.equal(tierFor(4, 3), 'suggestive'); assert.equal(tierFor(4, 2), 'mixed'); assert.equal(tierFor(3, 3), 'too-few');
});

test('every comparison is two real table readings, and agreement is read off them', () => {
  const reading = s => { const r = records.find(x => x.id === s.id); return r.velocity.some((v, i) => v === s.velocity && r.spread[i] === s.spread); };
  for (const f of FINDINGS.ranked) {
    assert.equal(f.pairs.length, f.comparisons, f.key);
    assert.equal(f.pairs.filter(p => p.agrees).length, f.agree, f.key);
    for (const p of f.pairs) {
      assert.ok(reading(p.expected) && reading(p.other), `${f.key}: ${p.expected.id} vs ${p.other.id}`);
      assert.equal(p.agrees, p.expected.spread > p.other.spread);
    }
    assert.deepEqual(f.ids, [...new Set(f.pairs.flatMap(p => [p.expected.id, p.other.id]))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  }
});

test('the exact airflow finding, with its exception and caveat computed from the rows', () => {
  const [airflow, thickness, width] = FINDINGS.ranked;
  assert.equal(airflow.lead, 'More airflow, faster spread.');
  assert.equal(airflow.text, 'Inside single tests, the faster airflow had the faster spread in 29 of 30 reading pairs, from 13 tests.');
  assert.deepEqual(airflow.exceptions, ['M3']);
  assert.match(airflow.caveat, /can’t separate airflow from falling oxygen\. The one exception, M3, is also the only test listed from low to high flow\./);
  // M7 has four readings, so it alone gives 6 of the 30 within-test pairs.
  assert.match(airflow.caveat, /The 30 pairs reuse readings, so they aren’t 30 independent results: M7 is in 6 of them\.$/);
  const m7 = airflow.pairs.find(p => p.expected.id === 'M7' && p.expected.velocity === 10 && p.other.velocity === 3);
  assert.deepEqual([m7.expected.spread, m7.other.spread], [0.106, 0.07]);
  assert.match(thickness.caveat, /All 3 exceptions had more starting oxygen on the thicker sheet\./);
  assert.match(width.caveat, /The one exception had more starting oxygen on the narrower sheet\./);
});

test('untracked spreads are left out, never counted as zero', () => {
  const untracked = records.filter(r => !r.spread).map(r => r.id);
  assert.deepEqual(untracked, ['M6', 'M12']);
  for (const f of FINDINGS.ranked) assert.ok(untracked.every(id => !f.ids.includes(id)), f.key);
  assert.match(FINDINGS.method, /M6 and M12 have no tracked spread, so they are left out, never counted as zero\./);
});

test('wording stays descriptive: a claim only when the evidence is consistent or suggestive, and never a safety word', () => {
  for (const f of FINDINGS.ranked) {
    assert.doesNotMatch(`${f.lead} ${f.text} ${f.caveat}`, /\bsafe|safer|safest|certif|recommend|\bcauses?\b|because/i, f.key);
    if (f.tier === 'too-few' || f.tier === 'mixed') assert.doesNotMatch(f.lead, /faster/, f.key);
  }
  assert.equal(FINDINGS.ranked.find(f => f.key === 'oxygen').lead, 'Oxygen.');
  assert.match(FINDINGS.caveat, /^Descriptive, not causal, and not a safety ranking\./);
});

test('the ranking is a pure function of the rows it is given', () => {
  const row = (id, t, v, s, o2) => ({ id, thicknessMm: t, widthMm: 22, burningSides: 2, velocity: v, spread: s, oxygenInitial: o2, oxygenFinal: o2 - 1 });
  const small = rankFindings([row('X1', 1, [10, 5], [0.1, 0.05], 21), row('X2', 3, [10], [0.04], 21)]);
  assert.equal(small.tests, 2);
  assert.deepEqual(small.ranked.map(f => [f.key, f.agree, f.comparisons]),
    [['airflow', 1, 1], ['thickness', 1, 1], ['width', 0, 0], ['oxygen', 0, 0], ['sides', 0, 0]]);
  assert.equal(small.ranked.find(f => f.key === 'width').text, 'No matched reading pairs in these tests.');
  assert.doesNotMatch(small.method, /left out/);
});

test('ask() carries the ranking only when the tests cover the cabin', () => {
  assert.equal(ask({ q: 'Will acrylic burn on the ISS?' }).findings, FINDINGS);
  assert.equal(ask({ thickness: 1 }).findings.tests, 20);
  assert.equal(ask({ mission: 'moon' }).findings, null);
  assert.equal(ask({ q: 'Will a 1 mm acrylic sheet burn in still air?' }).findings, null);
});

test('the method says what is and isn’t matched, counts distinct tests, and calls the tiers a display rule', () => {
  // Between-test comparisons never match oxygen, and the text says so wherever it applies.
  for (const f of FINDINGS.ranked.filter(x => ['thickness', 'width', 'sides'].includes(x.key))) {
    assert.deepEqual(f.notMatched, ['oxygen'], f.key); assert.match(f.text, /but not the same oxygen/, f.key); assert.match(f.caveat, /^Oxygen isn’t matched/, f.key);
  }
  assert.doesNotMatch(FINDINGS.method, /match on every listed condition/);
  assert.match(FINDINGS.method, /oxygen is not matched/); assert.match(FINDINGS.method, /not independent replications/);
  assert.match(FINDINGS.rule, /^This is the app’s display rule, not a statistical test\./);
  // Distinct tests sit beside every pair count, and they are the tests the pairs really come from.
  for (const f of FINDINGS.ranked) {
    assert.equal(f.tests, new Set(f.pairs.flatMap(p => [p.expected.id, p.other.id])).size, f.key);
    if (f.comparisons) assert.match(f.text, new RegExp(`in ${f.agree} of ${f.comparisons} reading pairs?, from ${f.tests} tests?\\.$`), f.key);
  }
  assert.deepEqual(FINDINGS.ranked.map(f => [f.key, f.comparisons, f.tests]), [['airflow', 30, 13], ['thickness', 26, 16], ['width', 4, 6], ['oxygen', 2, 4], ['sides', 1, 2]]);
  assert.equal(FINDINGS.ranked.find(f => f.key === 'oxygen').tierLabel, 'Too few pairs');
});

test('/api/data serves the ranking for the Findings section, whatever the question', async () => {
  const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const data = await (await fetch(`http://127.0.0.1:${server.address().port}/api/data`)).json();
    const row = f => [f.rank, f.key, f.tierLabel, f.agree, f.comparisons, f.ids.length];
    assert.deepEqual(data.findings.ranked.map(row), FINDINGS.ranked.map(row));
    assert.equal(data.findings.caveat, FINDINGS.caveat);
  } finally { await new Promise(r => server.close(r)); }
});
