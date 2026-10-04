import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PSI_25, parseCsv, tableFrom, experimentalTable } from '../src/acquire/psi.mjs';
import { records } from '../src/compute/evidence.mjs';

// The committed fixture is NASA's file as downloaded on 2026-09-24, so this runs offline on a clean clone.
const fixture = tableFrom(JSON.parse(readFileSync(new URL('../demo_fixtures/psi-25-experimental-table.json', import.meta.url), 'utf8')));
const o2 = (row, when) => Number(row[`Calibrated ${when} O2 % by vol`]);

test('our 40 transcribed O₂ values match NASA’s own PSI-25 experimental table', () => {
  assert.equal(fixture.rows.length, 129);
  for (const r of records) {
    const row = fixture.rows.find(x => x['Test #'] === r.id);
    assert.ok(row, `${r.id} is in the PSI-25 table`);
    assert.equal(o2(row, 'initial'), r.oxygenInitial, `${r.id} initial O₂`);
    assert.equal(o2(row, 'final'), r.oxygenFinal, `${r.id} final O₂`);
  }
});

test('published values reproduce exactly, and blank cells stay null', () => {
  const m7 = fixture.rows.find(x => x['Test #'] === 'M7'), b2 = fixture.rows.find(x => x['Test #'] === 'B2');
  assert.equal(m7['Calibrated initial O2 % by vol'], '18.9'); assert.equal(m7['Calibrated final O2 % by vol'], '18.4');
  assert.equal(b2['Final CO2 % by vol'], null);
  assert.deepEqual(parseCsv('﻿a,"b, ""c""",\r\n,x'), [['a', 'b, "c"', null], [null, 'x']]);
});

test('the PSI table loads offline through safe.mjs, with its DOI and licence', async () => {
  process.env.OFFLINE = '1';
  const table = await experimentalTable();
  assert.ok(['cache', 'fixture'].includes(table.source), table.source);
  assert.equal(table.doi, PSI_25.doi); assert.equal(table.license, 'CC0-1.0');
  assert.ok(records.every(r => table.rows.some(x => x['Test #'] === r.id)));
});
