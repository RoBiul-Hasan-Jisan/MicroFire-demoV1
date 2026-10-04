// Outcome evidence from the same BASS-II report: SIBAL fabric (Table 7.1) and Nomex (Table A.2),
// plus the thin-acrylic extinction speeds of Table 2.1. Pure loaders over data/, one source location per row.
import { readFileSync } from 'node:fs';
import { tableFrom } from './csv.mjs';

export const tablesProvenance = JSON.parse(readFileSync(new URL('../../data/bass-ii-tables.provenance.json', import.meta.url)));
const rows = file => tableFrom(readFileSync(new URL(`../../data/${file}`, import.meta.url), 'utf8')).rows;
const num = v => v === null ? null : Number(v);

// What happened, read from Table 7.1's own comment. A blank or 'BASS' comment means no event was noted,
// and the report says reused samples 'will not be discussed', so they stay out of every verdict.
const OUTCOME = { Quenched: 'quenched', 'Blow-off': 'blowoff', 'No blowoff': 'burned', 'No ignition': 'no-ignition', BASS: 'burned' };
function outcomeOf(comment) {
  if (comment === null) return 'burned';
  if (comment.startsWith('Reused')) return 'reused';
  if (!(comment in OUTCOME)) throw Error(`Unknown Table 7.1 comment: ${comment}`);
  return OUTCOME[comment];
}

export const fabricTests = rows('bass-fabric.csv').map(r => {
  const flow = r.flow_cm_s.split(/\s+to\s+/).map(Number);
  return { id: r.test_number, study: r.comment === 'BASS' ? 'BASS' : 'BASS-II', material: 'SIBAL', flowDirection: 'concurrent',
    widthMm: num(r.width_cm) * 10, flow, flowMin: Math.min(...flow), flowMax: Math.max(...flow), flowText: r.flow_cm_s,
    oxygen: num(r.o2_vol_pct), oxygenNote: r.o2_note, comment: r.comment, outcome: outcomeOf(r.comment),
    sourceLocation: `Table 7.1, printed p. 96, test ${r.test_number}` };
});

// Section 3.1.1: 'The three Nomex samples did not ignite.' Each row keeps Table A.2's own note.
export const nomexTests = rows('bass-nomex.csv').map(r => ({
  id: r.test_number, date: r.date, sample: r.sample_number, material: 'Nomex III', flowDirection: r.flow_configuration.toLowerCase(),
  fanDisplay: num(r.fan_display), airDisplay: num(r.air_display), oxygenInitial: num(r.o2_initial_vol_pct), oxygenFinal: num(r.o2_final_vol_pct),
  notes: r.notes, outcome: 'no-ignition', sourceLocation: `Table A.2, printed p. 105, test ${r.test_number}` }));

export const EXTINCTION = rows('bass-extinction.csv').map(r => ({
  o2: num(r.o2_percent), experimentMmS: num(r.experiment_mm_s), uncertaintyMmS: num(r.experiment_uncertainty_mm_s),
  computationMmS: num(r.computation_mm_s), theoryMmS: num(r.theory_mm_s), sourceLocation: 'Table 2.1, printed p. 28' }));
