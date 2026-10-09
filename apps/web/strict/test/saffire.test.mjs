import test from 'node:test';
import assert from 'node:assert/strict';
import { saffireSamples, saffireNotes, saffireProvenance, saffireRelated } from '../src/compute/saffire.mjs';
import { ask } from '../src/compute/scenario.mjs';

test('NASA’s Saffire-II table loads: 9 samples, with blank materials read from the row above', () => {
  assert.deepEqual(saffireSamples.map(s => s.sample), ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9']);
  assert.equal(saffireSamples.find(s => s.sample === '2-6').material, 'Cotton-Fiberglass (SIBAL)');
  assert.equal(saffireSamples.find(s => s.sample === '2-9').material, 'PMMA');
  assert.deepEqual([saffireProvenance.doi, saffireProvenance.license], ['10.60555/2chp-m469', 'CC0-1.0']);
});

test('published cells reproduce exactly, and the notes are word for word', () => {
  assert.deepEqual(saffireSamples.filter(s => /SIBAL/.test(s.material)).map(s => s.spreadMmS), [2.1, 2.6]);
  assert.equal(saffireSamples.find(s => s.sample === '2-2').oneGBurnLength, '7.6 cm');
  assert.equal(saffireNotes[2], 'The PMMA portion was completely consumed but the Nomex was not ignited.');
  assert.equal(saffireNotes[4], 'The flames remain anchored at the base of the sample which has a very slow regression rate (0.01 to 0.04 mm/s)');
});

test('silicone: no spread in orbit in 4 of 4, but 3 of 4 burned on the ground', () => {
  const s = saffireSamples.filter(x => x.material === 'Silicone');
  assert.equal(s.length, 4); assert.equal(s.filter(x => x.microgravityNoSpread).length, 4); assert.equal(s.filter(x => x.oneGBurned).length, 3);
  const r = ask({ q: 'Will silicone burn on the ISS?' });
  assert.equal(r.verdict.state, 'no-data', 'a separate experiment never becomes the verdict');
  assert.match(r.gaps[0].text, /None spread: NASA lists their burn length as about 0\. On the ground, matching samples burned in 3 of 4\./);
  assert.match(r.gaps[0].source.url, /investigations\/PSI-99$/);
});

test('covered answers show Saffire-II beside them, never inside them', () => {
  assert.match(ask({ q: 'Will SIBAL fabric burn on the ISS?' }).related.text, /spreading at 2\.1 and 2\.6 mm\/s with 20 cm\/s of airflow/);
  assert.match(ask({ q: 'Nomex on the ISS' }).related.text, /the Nomex was not ignited/);
  const pmma = ask({ q: 'Will acrylic burn on the ISS?' });
  assert.match(pmma.related.text, /anchored at the base/); assert.equal(pmma.verdict.count, '20 of 20 tests');
  assert.equal(ask({ mission: 'moon' }).related, null);
  assert.equal(saffireRelated('kapton'), null);
});
