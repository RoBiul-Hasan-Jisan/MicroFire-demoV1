import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRE_RESPONSE, STATUS } from '../src/compute/response.mjs';
import { FINDINGS } from '../src/compute/findings.mjs';
import { ENVELOPE } from '../src/compute/scenario.mjs';
import { FLEX_SUMMARY } from '../src/compute/flex.mjs';
import { createServer } from '../src/api/server.mjs';

test('NASA’s eight steps are quoted word for word, in NASA’s order, with the source and its date', () => {
  assert.equal(FIRE_RESPONSE.source.date, '2023-11-29');
  assert.match(FIRE_RESPONSE.source.url, /ochmo-tb-008-fire-protection\.pdf$/);
  assert.equal(FIRE_RESPONSE.source.intro, 'For a fire on ISS, the following actions will be taken sequentially by the crew until the fire is extinguished:');
  assert.deepEqual(FIRE_RESPONSE.steps.map(s => s.step), [
    'Fire detection and warning',
    'Terminate ventilation in the affected module to slow the spread of fire.',
    'Don protective masks',
    'Manually remove electrical power',
    'Use fire extinguishers to put out the flames',
    'If obvious signs of fire continue, the crew will power down the module',
    'After the fire has been extinguished, if breathing protection is required due to atmospheric contaminants from the fire or if a CO2 portable fire extinguisher was discharged, the crew will egress and isolate the affected module by closing the hatches.',
    'If atmospheric contaminants are present and require breathing protection, the affected module will remain isolated until atmospheric scrubbing has reduced monitored contaminants in the atmosphere (CO, HCN, HCL) to admissible concentrations.'
  ]);
  assert.deepEqual(FIRE_RESPONSE.steps.map(s => s.n), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('every evidence line cites its source, and each step’s evidence status is from the fixed list', () => {
  assert.deepEqual(FIRE_RESPONSE.steps.map(s => s.status), ['some', 'mixed', 'reason', 'none', 'related', 'none', 'reason', 'reason']);
  for (const s of FIRE_RESPONSE.steps) {
    assert.equal(s.statusLabel, STATUS[s.status], `step ${s.n}`);
    if (s.status === 'none') assert.equal(s.evidence.length, 0, `step ${s.n}`);
    for (const e of [...s.evidence, ...(s.differs ? [s.differs] : [])])
      assert.ok(e.source === null ? /^We found no /.test(e.text) : e.source.url.startsWith('https://') && e.source.label, `step ${s.n}: ${e.text}`);
  }
  assert.match(FIRE_RESPONSE.steps[4].differs.text, /water mist extinguishers for fires in the cabin/);
});

test('the BASS-II evidence line is computed from the rows, not typed in', () => {
  const airflow = FINDINGS.ranked.find(f => f.key === 'airflow'), line = FIRE_RESPONSE.steps[1].evidence[0];
  assert.equal(line.text, `This app’s 20 BASS-II tests: inside single tests, the faster airflow had the faster spread in ${airflow.agree} of ${airflow.comparisons} reading pairs, from ${airflow.tests} tests, but the table can’t separate airflow from falling oxygen. No test ran below ${ENVELOPE.flowMin} cm/s, so they say nothing about still air.`);
  assert.match(line.text, /29 of 30 reading pairs, from 13 tests/); assert.match(line.text, /below 2 cm\/s/);
  assert.match(line.source.url, /20210011385/);
});

test('the FLEX line is computed from NASA’s own table, and detection cites SAME', () => {
  const flex = FIRE_RESPONSE.steps[4].evidence.find(e => /^FLEX/.test(e.text));
  assert.equal(flex.text, `FLEX burned fuel droplets, not solids. ${FLEX_SUMMARY.co2} of its ${FLEX_SUMMARY.tests} tests added CO₂ to the air and ${FLEX_SUMMARY.he} added helium, to “determine how the presence of a suppressant influences the LOI”, the lowest oxygen that still burns.`);
  assert.match(flex.text, /123 of its 274 tests added CO₂ to the air and 50 added helium/);
  assert.match(flex.source.url, /investigations\/PSI-69$/);
  assert.ok(FIRE_RESPONSE.steps[1].evidence.some(e => /below 10 ± 5 mm\/s at 21% O₂, and 30 ± 5 mm\/s at 16%/.test(e.text) && /Table 2\.1/.test(e.source.name)));
  assert.ok(FIRE_RESPONSE.steps[0].evidence.some(e => /investigations\/PSI-102$/.test(e.source?.url ?? '')));
});

test('outside NASA’s own quotes, the wording never gives orders or a safety rating', () => {
  const unquoted = t => t.replace(/“[^”]*”/g, '');
  const own = [FIRE_RESPONSE.method, FIRE_RESPONSE.source.caveat, ...FIRE_RESPONSE.limitations,
    ...FIRE_RESPONSE.steps.flatMap(s => [...s.evidence, ...(s.differs ? [s.differs] : [])].map(e => unquoted(e.text)))];
  for (const t of own) assert.doesNotMatch(t, /\bsafe\b|safer|safest|\bshould\b|\bmust\b|recommend|\bensure\b/i, t);
});

test('/api/data serves the fire response next to the rows', async () => {
  const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const data = await (await fetch(`http://127.0.0.1:${server.address().port}/api/data`)).json();
    assert.equal(data.records.length, 20);
    assert.equal(data.fireResponse.steps.length, 8);
    assert.equal(data.fireResponse.steps[1].statusLabel, 'Mixed evidence');
  } finally { await new Promise(r => server.close(r)); }
});
