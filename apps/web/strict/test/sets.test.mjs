import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fabricTests, nomexTests, EXTINCTION, tablesProvenance } from '../src/compute/sets.mjs';
import { ask } from '../src/compute/scenario.mjs';
import { tableFrom } from '../src/compute/csv.mjs';

test('Table 7.1 transcribes the way the report counts it', () => {
  assert.equal(fabricTests.length, 31);
  const bass2 = fabricTests.filter(t => t.study === 'BASS-II'), tally = o => bass2.filter(t => t.outcome === o).length;
  assert.equal(bass2.length, 27);
  // "six quenching tests, three nonignited tests, and one blowoff test" (p. 95), plus 8 reused samples
  assert.deepEqual([tally('quenched'), tally('no-ignition'), tally('blowoff'), tally('reused')], [6, 3, 1, 8]);
  assert.equal(fabricTests.filter(t => t.study === 'BASS').length, 4);
});

test('published rows reproduce exactly, and flow ranges keep their order', () => {
  const t4 = fabricTests.find(t => t.id === 'GMT45-T4');
  assert.deepEqual([t4.widthMm, t4.flow, t4.oxygen, t4.comment, t4.outcome], [22, [10, 2.2], 18.7, 'Quenched', 'quenched']);
  const t21 = fabricTests.find(t => t.id === 'GMT190-T21');
  assert.deepEqual([t21.widthMm, t21.flowMin, t21.flowMax, t21.oxygen, t21.outcome], [12, 11, 47, 17.2, 'blowoff']);
  assert.equal(fabricTests.find(t => t.id === 'GMT45-T1').oxygenNote, 'O2 reading in these two tests might be inaccurate.');
  assert.deepEqual(EXTINCTION.map(e => [e.o2, e.experimentMmS, e.uncertaintyMmS, e.computationMmS, e.theoryMmS]), [[21, 10, 5, 15, 7.5], [16, 30, 5, 35, 10]]);
});

test('the Nomex rows match NASA’s own PSI-25 table, and a missing reading stays missing', () => {
  const psi = tableFrom(JSON.parse(readFileSync(new URL('../demo_fixtures/psi-25-experimental-table.json', import.meta.url), 'utf8'))).rows;
  for (const n of nomexTests) {
    const row = psi.find(r => r['Test #'] === n.id);
    assert.equal(Number(row['Calibrated initial O2 % by vol']), n.oxygenInitial, n.id);
    assert.match(row['Fuel Sample Material'], /nomex/i, n.id);
  }
  assert.equal(nomexTests.find(n => n.id === 'F3').oxygenFinal, null);
  assert.match(tablesProvenance.tables['data/bass-nomex.csv'].location, /Table A\.2, Ferkul test matrix, printed p\. 105/);
});

test('SIBAL fabric gets a mixed answer, with the reasons computed from the rows', () => {
  const r = ask({ q: 'Will SIBAL fabric burn on the ISS?' });
  assert.equal(r.verdict.state, 'mixed'); assert.equal(r.verdict.count, '20 of 23 tests burned');
  assert.equal(r.verdict.sub, 'The 3 that didn’t ignite were at 16.4–16.8% oxygen. 6 went out as the airflow was turned down, and 1 blew out as it was turned up.');
  assert.equal(r.evidence.kind, 'outcomes'); assert.equal(r.findings, null); assert.equal(r.why, null);
  assert.ok(r.evidence.ids.every(id => !fabricTests.find(t => t.id === id).comment?.startsWith('Reused')), 'reused samples stay out');
  // At 19 cm/s: one test held there, three passed through it while the flow was changed, and each was still burning.
  const at19 = ask({ q: 'SIBAL fabric on the ISS at 19 cm/s' });
  assert.equal(at19.verdict.count, '4 of 4 matching tests');
  assert.deepEqual(at19.evidence.ids, ['GMT45-T15', 'GMT178-T17', 'GMT190-T21', 'GMT222-T11']);
});

test('Nomex gets “No flame held”, which never reads as a safety rating', () => {
  const r = ask({ q: 'Is Nomex safe on the ISS?' });
  assert.equal(r.verdict.state, 'no-burn'); assert.equal(r.verdict.count, '0 of 3 tests');
  assert.match(r.verdict.sub, /^That isn’t a safety rating/);
  assert.ok(r.notices.some(n => /can’t certify/.test(n)));
  assert.doesNotMatch(JSON.stringify([r.verdict, r.evidence.finding, r.evidence.caveat]), /\bis safe|\bsafer\b|safest|fireproof|certified/i);
  assert.deepEqual(r.evidence.tests.map(t => t.happened), nomexTests.map(n => n.notes));
  assert.equal(ask({ q: 'Nomex at 10 cm/s' }).verdict.state, 'no-data', 'airflow isn’t given in cm/s for these tests');
});

test('cotton and untested fabrics point to SIBAL without pretending it is cotton', () => {
  const r = ask({ q: 'Will cotton fabric burn on the ISS?' });
  assert.equal(r.verdict.state, 'no-data'); assert.deepEqual(r.nearest.params, { material: 'sibal' });
  assert.match(r.gaps[0].text, /isn’t pure cotton/);
  assert.equal(ask({ q: 'a 1 mm SIBAL fabric' }).verdict.state, 'no-data', 'thickness isn’t recorded for fabric');
});

test('still air shows Table 2.1’s extinction speeds for acrylic', () => {
  const r = ask({ q: 'Will a 1 mm acrylic sheet burn in still air?' });
  assert.ok(r.gaps.some(g => /below 1 ± 0.5 cm\/s at 21% O₂, and 3 ± 0.5 cm\/s at 16%/.test(g.text) && /Table 2\.1/.test(g.source.name)));
});
