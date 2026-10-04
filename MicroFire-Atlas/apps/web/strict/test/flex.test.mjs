import test from 'node:test';
import assert from 'node:assert/strict';
import { flexTests, FLEX_SUMMARY, flexProvenance } from '../src/compute/flex.mjs';

test('NASA’s FLEX table loads: 274 droplet tests, 123 with CO₂ and 50 with helium', () => {
  assert.equal(FLEX_SUMMARY.tests, 274); assert.equal(FLEX_SUMMARY.co2, 123); assert.equal(FLEX_SUMMARY.he, 50);
  assert.equal(flexProvenance.investigation, 'PSI-69'); assert.equal(flexProvenance.doi, '10.60555/mbq8-0451');
  assert.equal(flexProvenance.license, 'CC0-1.0');
});

test('two published rows reproduce exactly', () => {
  assert.deepEqual(flexTests[0], { test: '1', fuel: 'Methanol', pressureMmHg: 757.7, o2: 0.21, n2: 0.79, co2: 0, he: 0, dropletMm: 1.69, end: 'Disruption' });
  assert.deepEqual([flexTests[1].test, flexTests[1].pressureMmHg, flexTests[1].dropletMm, flexTests[1].end], ['2', 762, 1.86, 'Extinction']);
});

test('the unlabelled gas columns are O₂, N₂, CO₂ and He: every row adds up to about 1', () => {
  // NASA rounds each fraction to two decimals, so a row can add up to 0.98 (plus floating-point noise).
  for (const t of flexTests) assert.ok(Math.abs(t.o2 + t.n2 + t.co2 + t.he - 1) <= 0.02 + 1e-9, `test ${t.test}`);
});

test('NASA’s en dash for “no value” stays missing, never 0 or NaN', () => {
  const missing = flexTests.filter(t => t.dropletMm === null);
  assert.ok(missing.length > 0);
  assert.ok(flexTests.every(t => t.dropletMm === null || t.dropletMm > 0), 'no zero or NaN droplet sizes');
  assert.ok(flexTests.every(t => [t.o2, t.n2, t.co2, t.he, t.pressureMmHg].every(Number.isFinite)), 'gas fractions and pressure are all numbers');
});
