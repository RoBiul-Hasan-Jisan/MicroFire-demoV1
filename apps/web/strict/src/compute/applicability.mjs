// Which NASA observations support a cabin scenario (ADR-012). The policy:
//  1. Set-level conditions come from how an experiment ran: the material tested, microgravity aboard the ISS, and
//     the station's own air inside a glovebox. No table records pressure, so pressure is never a measured match.
//     It is "not recorded", and only the station's nominal cabin pressure is consistent with how the tests ran.
//  2. Every other condition the question or a tap gives is checked against each test's own row, all together.
//     A test supports the scenario only if its row records every one of them. No tolerance is added, and nothing
//     is interpolated between or extrapolated beyond the recorded values.
//  3. Table 5.1 gives each acrylic test's oxygen only at its start and end. A requested oxygen inside that span was
//     passed through during the burn, but the table can't tie it to one airflow reading. So oxygen and airflow are
//     never established together within one acrylic test.
//  4. Tests that miss stay visible as the closest evidence, with each recorded value and the reason it misses.
import { records } from './evidence.mjs';
import { fabricTests, nomexTests } from './sets.mjs';
import { SOURCES } from './catalog.mjs';

const round1 = x => Math.round(x * 10) / 10;
const KPA_PER_PSI = 6.894757;
const range = (a, b, unit = '') => a === b ? `${a}${unit}` : `${a}–${b}${unit}`;
const sorted = xs => [...new Set(xs)].sort((a, b) => a - b);

// The station's nominal cabin pressure, the Earth-normal preset. BASS and BASS-II ran in the station's glovebox,
// and the report compares its extinction speeds "at 1 atm" (Table 2.1). No test row records a pressure.
export const STATION_PSI = 14.7;
const PRESSURE_NOTE = 'No table records pressure. BASS-II ran in the station’s glovebox, and the report treats it as 1 atm.';

// Overall bounds of a set: context for headlines and gap cards, never a match on their own.
function boundsOf({ o2, flows = null, thicknesses = null, widths = null }) {
  const o2Min = Math.min(...o2), o2Max = Math.max(...o2), kpa = round1(STATION_PSI * KPA_PER_PSI);
  return { gravity: 0, psi: STATION_PSI, pressureNote: PRESSURE_NOTE, o2Min, o2Max, po2Min: round1(kpa * o2Min / 100), po2Max: round1(kpa * o2Max / 100),
    flowMin: flows ? Math.min(...flows) : null, flowMax: flows ? Math.max(...flows) : null, flows: flows ? sorted(flows) : null, thicknesses, widths };
}

export const ENVELOPE = (() => {
  const e = boundsOf({ o2: records.flatMap(r => [r.oxygenInitial, r.oxygenFinal]), flows: records.flatMap(r => r.velocity),
    thicknesses: sorted(records.map(r => r.thicknessMm)), widths: sorted(records.map(r => r.widthMm)) });
  e.summary = `Microgravity aboard the ISS, in the station’s glovebox, ${e.o2Min}–${e.o2Max}% O₂, ${e.flowMin}–${e.flowMax} cm/s of airflow against the flame at set values, ${e.thicknesses[0]}–${e.thicknesses.at(-1)} mm acrylic sheets.`;
  return { ...e, material: 'pmma' };
})();

const usedFabric = fabricTests.filter(t => t.outcome !== 'reused');
const fabricBounds = boundsOf({ o2: usedFabric.map(t => t.oxygen), flows: usedFabric.flatMap(t => t.flow), widths: sorted(usedFabric.map(t => t.widthMm)) });
fabricBounds.summary = `Microgravity aboard the ISS, in the station’s glovebox, ${fabricBounds.o2Min}–${fabricBounds.o2Max}% O₂ (one value per test), ${fabricBounds.flowMin}–${fabricBounds.flowMax} cm/s of airflow running with the flame, SIBAL fabric strips ${fabricBounds.widths.map(w => w / 10).join(' and ')} cm wide.`;
const nomexBounds = boundsOf({ o2: nomexTests.flatMap(t => [t.oxygenInitial, t.oxygenFinal]).filter(v => v !== null) });
nomexBounds.summary = `Microgravity aboard the ISS, in the station’s glovebox, ${nomexBounds.o2Min}–${nomexBounds.o2Max}% O₂, airflow running with the flame (its speed isn’t given), ${nomexTests.length} Nomex III samples.`;

// One evidence set per tested material. Acrylic carries spread rates; fabric and Nomex carry outcomes.
export const SETS = {
  pmma: { id: 'pmma', kind: 'spread', tested: 'Acrylic (PMMA)', envelope: ENVELOPE, rows: records, source: SOURCES.report },
  sibal: { id: 'sibal', kind: 'outcomes', tested: 'SIBAL fabric', envelope: fabricBounds, rows: usedFabric, excluded: fabricTests.length - usedFabric.length, source: SOURCES.fabric },
  nomex: { id: 'nomex', kind: 'outcomes', tested: 'Nomex III', envelope: nomexBounds, rows: nomexTests, excluded: 0, source: SOURCES.nomex }
};
// Untested materials are shown against the acrylic set, so its tests still say what was covered.
export const setFor = s => SETS[s.material.id] ?? SETS.pmma;

// How each set records each per-test condition. A missing entry means the set's rows don't record it at all.
const O2 = s => s.air.o2;
export const PER_TEST = [
  { key: 'oxygen', label: 'Oxygen', given: s => s.air.explicitO2, yours: s => `${s.air.o2}%`,
    pmma: { test: (r, s) => O2(s) <= r.oxygenInitial && O2(s) >= r.oxygenFinal, recorded: r => `${r.oxygenInitial}% → ${r.oxygenFinal}%` },
    sibal: { test: (t, s) => t.oxygen === O2(s), recorded: t => `${t.oxygen}%` },
    nomex: { test: (t, s) => t.oxygenFinal === null ? t.oxygenInitial === O2(s) : O2(s) <= t.oxygenInitial && O2(s) >= t.oxygenFinal,
      recorded: t => t.oxygenFinal === null ? `${t.oxygenInitial}% → not read` : `${t.oxygenInitial}% → ${t.oxygenFinal}%` } },
  { key: 'airflow', label: 'Airflow', given: s => s.airflow !== null, yours: s => s.airflow === 0 ? 'Still air' : `${s.airflow} cm/s`,
    // Table 5.1 lists the airflow each acrylic test was set to while it burned.
    pmma: { test: (r, s) => r.velocity.includes(s.airflow), recorded: r => `${r.velocity.join(', ')} cm/s` },
    // Table 7.1: one value is a held flow; "10 to 5" is a flow changed from 10 to 5 during the test (the report says
    // at a rate that varied), so every value in between was passed through.
    sibal: { test: (t, s) => t.flow.length === 1 ? t.flow[0] === s.airflow : s.airflow >= t.flowMin && s.airflow <= t.flowMax, recorded: t => `${t.flowText} cm/s` } },
  { key: 'thickness', label: 'Thickness', given: s => s.thickness !== null, yours: s => `${s.thickness} mm`,
    pmma: { test: (r, s) => r.thicknessMm === s.thickness, recorded: r => `${r.thicknessMm} mm` } },
  { key: 'width', label: 'Width', given: s => s.width !== null, yours: s => `${s.width / 10} cm`,
    pmma: { test: (r, s) => r.widthMm === s.width, recorded: r => `${r.widthMm / 10} cm` },
    sibal: { test: (t, s) => t.widthMm === s.width, recorded: t => `${t.widthMm / 10} cm` } }
];

// What a fabric sample did at one airflow. Quench and blow-off happened as the flow reached the end of its change.
export function outcomeAt(t, v) {
  if (t.outcome === 'no-ignition') return 'no-ignition';
  if (v === null) return t.outcome;
  if (t.flow.length > 1 && v === t.flow.at(-1) && (t.outcome === 'quenched' || t.outcome === 'blowoff')) return t.outcome;
  return 'burned';
}

// The readings of an acrylic test that match the scenario: every reading, or only those at the requested airflow.
export const readingsFor = (r, s) => r.velocity.map((v, i) => ({ id: r.id, thicknessMm: r.thicknessMm, velocity: v, spread: r.spread ? r.spread[i] : null }))
  .filter(p => s.airflow === null || p.velocity === s.airflow);

/** Checks a resolved scenario against the rows of its evidence set. */
export function applicability(s) {
  const set = setFor(s), E = set.envelope, checks = [];
  const add = c => checks.push({ ...c, ok: !c.blocking });

  add({ key: 'material', label: 'Material', yours: s.material.name.replace(' sheet', ''), status: s.material.supported ? 'match' : 'mismatch', blocking: !s.material.supported,
    tested: s.material.supported ? set.tested : Object.values(SETS).map(x => x.tested).join(', ') });
  add({ key: 'gravity', label: 'Gravity', yours: s.mission.gText, tested: 'µg (ISS)', status: s.mission.g === 0 ? 'match' : 'mismatch', blocking: s.mission.g !== 0 });

  // Every condition given for individual tests, evaluated on every row of the set.
  const given = PER_TEST.filter(c => c.given(s));
  const rows = set.rows.map(row => ({ row, results: given.map(c => c[set.id]
    ? { key: c.key, label: c.label, ok: c[set.id].test(row, s), recorded: c[set.id].recorded(row) }
    : { key: c.key, label: c.label, ok: false, recorded: 'Not recorded' }) }));
  const untiedKeys = set.id === 'pmma' && s.air.explicitO2 && s.airflow !== null;   // rule 3
  const allOk = x => x.results.every(r => r.ok);
  const joint = rows.filter(x => allOk(x) && !untiedKeys);
  const status = key => {
    const c = given.find(g => g.key === key);
    if (!c[set.id]) return 'unrecorded';
    if (joint.length) return 'match';
    return rows.some(x => x.results.find(r => r.key === key).ok) ? 'separately' : 'mismatch';
  };
  const perTest = key => {
    const c = given.find(g => g.key === key), st = status(key);
    const tested = !c[set.id] ? 'Not recorded' : key === 'oxygen' ? (set.id === 'sibal' ? `${range(E.o2Min, E.o2Max, '%')}, one value per test` : `${range(E.o2Min, E.o2Max, '%')}, start and end of each test`)
      : key === 'airflow' ? (set.id === 'pmma' ? `${E.flows.join(', ')} cm/s (set values)` : range(E.flowMin, E.flowMax, ' cm/s'))
      : key === 'thickness' ? `${E.thicknesses.join(', ')} mm` : `${E.widths.map(w => w / 10).join(' and ')} cm`;
    add({ key, label: c.label, yours: c.yours(s), tested, status: st, blocking: st === 'mismatch' || st === 'unrecorded',
      note: st === 'separately' ? 'Recorded in some tests, but not in one test together with your other conditions.' : undefined });
  };

  // Oxygen: a number you gave is matched per test. A preset is set-level: the tests used the station's own air.
  if (s.air.explicitO2) perTest('oxygen');
  else {
    const station = s.air.preset === 'earth';
    add({ key: 'oxygen', label: 'Oxygen', yours: `${s.air.o2}%`, tested: `${range(E.o2Min, E.o2Max, '%')} recorded`, status: station ? 'context' : 'mismatch', blocking: !station,
      note: station ? 'The tests used the station’s own air in a glovebox. Its oxygen varied between tests and fell during each burn.' : undefined });
  }
  const stationPressure = s.air.explicitPsi ? round1(s.air.psi) === STATION_PSI : s.air.preset === 'earth';
  add({ key: 'pressure', label: 'Pressure', yours: `${s.air.psi} psi`, tested: 'Not recorded', status: stationPressure ? 'unrecorded' : 'mismatch', blocking: !stationPressure, note: E.pressureNote });
  for (const key of ['airflow', 'thickness', 'width']) if (given.some(c => c.key === key)) perTest(key);
  for (const u of s.unrecorded || []) add({ key: u.key, label: u.label, yours: u.value, tested: 'Not recorded', status: 'unrecorded', blocking: true,
    note: `These tables don’t record ${u.label.toLowerCase()}.` });

  const perTestFailed = checks.some(c => given.some(g => g.key === c.key) && c.blocking);
  const untied = untiedKeys && rows.some(allOk);
  if (given.length > 1 && !joint.length && !perTestFailed)
    add({ key: 'together', label: 'Together', yours: 'All of the above', tested: 'Not in one test', status: 'mismatch', blocking: true,
      note: untied ? 'Table 5.1 gives each test’s oxygen only at its start and end, so an oxygen level can’t be tied to one airflow reading.' : 'No single test recorded all of these.' });

  const failed = checks.filter(c => c.blocking).map(c => c.key);
  const matched = failed.length ? [] : joint.map(x => x.row);
  const closest = matched.length || !given.length ? [] : rows.filter(x => x.results.some(r => r.ok))
    .sort((a, b) => b.results.filter(r => r.ok).length - a.results.filter(r => r.ok).length)
    .slice(0, 5).map(x => ({ id: x.row.id, conditions: x.results, untied: untiedKeys && allOk(x), sourceLocation: x.row.sourceLocation }));
  // Which tests record each given condition on its own, for the "not together" explanation.
  const coverage = Object.fromEntries(given.map((c, i) => [c.key, rows.filter(x => x.results[i].ok).map(x => x.row.id)]));
  return { set, checks, failed, matched, covered: !failed.length, closest, coverage, given: given.map(c => c.key), untied };
}
