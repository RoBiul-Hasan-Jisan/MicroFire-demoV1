// Will It Burn? — turns a question (or tapped controls) into a cabin scenario, checks it against NASA's tests
// with the applicability policy in applicability.mjs (ADR-012), and builds the answer.
// Every number returned here comes from data/ or from a cited source.
import { FINDINGS } from './findings.mjs';
import { EXTINCTION } from './sets.mjs';
import { saffireRelated } from './saffire.mjs';
import { SOURCES, MISSIONS, AIRS, MATERIALS, placeFor, otherMaterial } from './catalog.mjs';
import { ENVELOPE, SETS, STATION_PSI, applicability, outcomeAt, readingsFor } from './applicability.mjs';
import { parseQuestion } from './question.mjs';

export { SOURCES, MISSIONS, AIRS, MATERIALS, ENVELOPE, SETS, parseQuestion };
export class InputError extends Error {}

const KPA_PER_PSI = 6.894757;
const round1 = x => Math.round(x * 10) / 10;
const kpa = psi => round1(psi * KPA_PER_PSI);
const range = (a, b, unit = '') => a === b ? `${a}${unit}` : `${a}–${b}${unit}`;
const list = xs => xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sorted = xs => [...new Set(xs)].sort((a, b) => a - b);

export const POLICY = 'A test counts only if its own row records every condition you gave, all together. Nothing is interpolated between recorded values or stretched beyond them. Pressure isn’t in any table, so it is never a measured match. Acrylic oxygen is recorded only at the start and end of each test, so it can’t be tied to one airflow reading.';
const STATUS_LABEL = { match: 'Match', context: 'Station air', unrecorded: 'Not recorded', separately: 'In other tests', mismatch: 'Gap' };

const given = (params, key) => params[key] !== undefined && params[key] !== null && params[key] !== '';
function number(value, label, min, max) {
  const n = Number(value);
  if (typeof value === 'boolean' || !Number.isFinite(n) || n < min || n > max) throw new InputError(`${label} must be a number from ${min} to ${max}.`);
  return n;
}

function airFor(psi, o2, preset, explicitO2 = false, explicitPsi = false) {
  const named = Object.values(AIRS).find(a => a.psi === psi && a.o2 === o2);
  return { key: named ? named.key : 'custom', name: named ? named.name : 'Custom', preset, explicitO2, explicitPsi, psi, o2, kpa: kpa(psi), po2: round1(kpa(psi) * o2 / 100) };
}
const stationAir = () => airFor(AIRS.earth.psi, AIRS.earth.o2, 'earth');

/** Explicit params (tapped controls) beat the question, and the question beats defaults. */
export function resolveScenario(params = {}) {
  if (given(params, 'q') && String(params.q).length > 500) throw new InputError('Keep the question under 500 characters.');
  const parsed = parseQuestion(params.q), f = parsed.fields, from = {};
  const source = key => given(params, key) ? 'picked' : f[key] !== undefined ? 'question' : 'default';

  from.mission = source('mission');
  const missionId = from.mission === 'picked' ? String(params.mission) : f.mission ?? 'iss';
  const tile = MISSIONS.find(m => m.id === missionId);
  const mission = tile ? { ...tile, supported: true }
    : placeFor(missionId, from.mission === 'picked' ? params.place : f.place,
      from.mission === 'picked' ? (given(params, 'g') ? number(params.g, 'Gravity', 0, 10) : null) : f.g ?? null);
  if (!mission) throw new InputError('Unknown mission. Use iss, moon, transit or mars.');

  let preset, airFrom;
  if (given(params, 'air')) { preset = String(params.air); airFrom = 'picked'; }
  else if (f.air) { preset = f.air; airFrom = 'question'; }
  else { preset = mission.air; airFrom = 'default'; }
  if (!AIRS[preset]) throw new InputError('Unknown cabin air. Use earth or exploration.');
  let { psi, o2 } = AIRS[preset], explicitO2 = false, explicitPsi = false;
  const useParsed = !given(params, 'air');
  if (given(params, 'o2')) { o2 = number(params.o2, 'Oxygen', 0, 100); explicitO2 = true; airFrom = 'picked'; }
  else if (useParsed && f.o2 !== undefined) { o2 = f.o2; explicitO2 = true; airFrom = 'question'; }
  if (given(params, 'psi')) { psi = number(params.psi, 'Pressure', 0, 1000); explicitPsi = true; airFrom = 'picked'; }
  else if (useParsed && f.psi !== undefined) { psi = f.psi; explicitPsi = true; airFrom = 'question'; }
  from.air = airFrom;
  const air = airFor(psi, o2, preset, explicitO2, explicitPsi);

  from.material = source('material');
  const materialId = from.material === 'picked' ? String(params.material) : f.material ?? 'pmma';
  const listed = MATERIALS.find(m => m.id === materialId);
  const material = listed ? { id: listed.id, name: listed.name, inline: listed.inline, supported: !!listed.supported }
    : materialId === 'other' ? otherMaterial(from.material === 'picked' ? params.materialName : f.materialName) : null;
  if (!material) throw new InputError('Unknown material.');

  // Question values were already checked by the reader; tapped values are checked here.
  const pickNumber = (key, label, min, max, anyWord) => {
    from[key] = source(key);
    const v = from[key] === 'picked' ? params[key] : f[key];
    if (v === undefined || v === anyWord || v === 'all') return null;
    return from[key] === 'picked' ? number(v, label, min, max) : v;
  };
  const thickness = pickNumber('thickness', 'Thickness', 0.001, 1000, 'all');
  const width = pickNumber('width', 'Width', 0.1, 10000, 'all');
  const airflow = pickNumber('airflow', 'Airflow', 0, 100000, 'none');

  // A tap replaces the part of the question it covers, so that part's reading problem no longer applies.
  const replacedBy = { o2: ['o2', 'air'], psi: ['psi', 'air'], airflow: ['airflow'], thickness: ['thickness'], width: ['width'], gravity: ['mission'] };
  const unresolved = parsed.unresolved.filter(u => !(replacedBy[u.key] || []).some(k => given(params, k)));
  return { mission, air, material, thickness, width, airflow, from, parsed, unresolved, unrecorded: parsed.unrecorded, safety: parsed.safety };
}

// ---------- Headlines and gap cards ----------
function headlineFor(s, A) {
  const E = A.set.envelope, first = A.failed[0], c = A.checks.find(x => x.key === first);
  if (first === 'material') return `Unknown. There’s no ${s.material.inline} data in this set.`;
  if (first === 'gravity') return s.mission.id === 'earth' ? 'Not in this data. These tests only ran in microgravity, not at Earth’s gravity.'
    : s.mission.supported ? `Unknown. None of these tests felt ${s.mission.adj} gravity.` : `Not in this data. These tests only ran in microgravity, not ${s.mission.phrase}.`;
  if (first === 'oxygen') return s.air.o2 > E.o2Max ? `Unknown. These tests stopped at ${E.o2Max}% oxygen.`
    : s.air.o2 < E.o2Min ? `Unknown. These tests never went below ${E.o2Min}% oxygen.` : `Unknown. No test recorded exactly ${s.air.o2}% oxygen.`;
  if (first === 'pressure') return s.air.explicitPsi ? `Unknown. No test here is documented at ${s.air.psi} psi.` : 'Unknown. These tests only ran at station pressure.';
  if (first === 'airflow') return c.status === 'unrecorded' ? 'Unknown. These tests don’t give their airflow in cm/s.'
    : s.airflow === 0 ? 'Unknown. These tests never ran in still air.' : s.airflow < E.flowMin ? `Unknown. These tests never ran below ${E.flowMin} cm/s.`
    : s.airflow > E.flowMax ? `Unknown. These tests never ran above ${E.flowMax} cm/s.` : `Unknown. No test ran at exactly ${s.airflow} cm/s.`;
  if (first === 'thickness') return c.status === 'unrecorded' ? 'Unknown. These tests don’t record sample thickness.' : `Unknown. These tests only used ${list(E.thicknesses.map(String))} mm sheets.`;
  if (first === 'width') return c.status === 'unrecorded' ? 'Unknown. These tests don’t record sample width.' : `Unknown. These tests only used ${list(E.widths.map(w => String(w / 10)))} cm wide samples.`;
  if (first === 'together') return A.untied ? 'Unknown. The table can’t tie an oxygen level to one airflow reading.' : 'Unknown. No single test had all of these conditions.';
  return `Unknown. These tests don’t record ${c.label.toLowerCase()}.`;
}

// The airflow settings just below and above a requested one, with the tests that used them.
function neighbours(set, v) {
  const at = x => set.rows.filter(r => r.velocity.includes(x)).map(r => r.id);
  const below = set.envelope.flows.filter(x => x < v).at(-1), above = set.envelope.flows.find(x => x > v);
  return [below, above].filter(x => x !== undefined).map(x => `${x} cm/s (${list(at(x))})`);
}

function gapsFor(s, A) {
  const set = A.set, E = set.envelope, gaps = [], has = k => A.failed.includes(k), check = k => A.checks.find(c => c.key === k);
  if (has('material')) gaps.push(['cotton', 'fabric'].includes(s.material.id)
    ? { topic: 'Material', text: 'The closest NASA data here is SIBAL, a cotton-fibreglass fabric blend that BASS-II burned in orbit. It isn’t pure cotton, so it can’t stand in for your fabric.', source: SOURCES.fabric }
    : s.material.id === 'silicone'
    ? { topic: 'Material', text: `${saffireRelated('silicone').text} Its oxygen is estimated from CO₂ and its airflow ran with the flame, so this app shows it beside the answer, not as one.`, source: saffireRelated('silicone').source }
    : { topic: 'Material', text: `This prototype holds NASA’s acrylic sheets, SIBAL fabric and Nomex tests. ${s.material.name} needs more NASA reports added to the corpus.`, source: SOURCES.report });
  if (has('gravity')) {
    if (s.mission.id === 'earth') gaps.push({ topic: 'Gravity', text: 'These NASA tests ran only in orbit. In a related BASS-II study, acrylic rods kept burning at 17% O₂ in orbit, while on the ground rods of the same sizes couldn’t keep a flame at 18% or below. Gravity can change the answer either way, so orbit results don’t answer an Earth question.', source: SOURCES.gravityRods });
    else if (!s.mission.supported) gaps.push({ topic: 'Gravity', text: `These NASA tests ran only in microgravity aboard the ISS. None ran ${s.mission.phrase}.`, source: set.source });
    else {
      gaps.push({ topic: 'Gravity', text: 'Partial gravity is barely tested. The first burns lasting more than 25 seconds in simulated lunar gravity were only reported in 2025, from a spinning suborbital rocket.', source: SOURCES.luci });
      gaps.push({ topic: 'Gravity', text: 'For acrylic rods, early drop-tower centrifuge results put lunar gravity near the worst case: it’s where the rods kept burning at the lowest oxygen.', source: SOURCES.partialGravity });
    }
  }
  const exactMiss = has('oxygen') && s.air.explicitO2 && s.air.o2 >= E.o2Min && s.air.o2 <= E.o2Max;
  if (exactMiss) {
    const values = sorted(set.rows.map(t => t.oxygen ?? t.oxygenInitial));
    const below = values.filter(x => x < s.air.o2).at(-1), above = values.find(x => x > s.air.o2);
    gaps.push({ topic: 'Oxygen', text: `These tests recorded one oxygen value each, from ${E.o2Min}% to ${E.o2Max}%. None recorded exactly ${s.air.o2}%. The nearest were ${list([below, above].filter(x => x !== undefined).map(x => `${x}%`))}, and this app doesn’t fill the gap between them.`, source: set.source });
  } else if (has('oxygen') || has('pressure')) {
    const inside = s.air.po2 >= E.po2Min && s.air.po2 <= E.po2Max;
    const n2Ratio = (s.air.kpa * (1 - s.air.o2 / 100)) / (kpa(STATION_PSI) * 0.79);
    const nitrogen = n2Ratio < 0.5 ? ' But it has less than half the nitrogen that soaks up a flame’s heat, so the ISS tests don’t stretch that far.'
      : n2Ratio < 0.9 ? ' But it has less nitrogen to soak up a flame’s heat, so the ISS tests don’t stretch that far.' : '';
    gaps.push(inside
      ? { topic: 'Oxygen & pressure', text: `Your cabin’s oxygen partial pressure, ${s.air.po2} kPa, sits inside the tested ${E.po2Min}–${E.po2Max} kPa.${nitrogen}`, source: SOURCES.atmosphere }
      : { topic: 'Oxygen & pressure', text: `Your cabin’s oxygen partial pressure, ${s.air.po2} kPa, is outside the tested ${E.po2Min}–${E.po2Max} kPa as well.`, source: set.source });
    if (s.air.o2 > E.o2Max || s.air.psi < STATION_PSI) gaps.push({ topic: 'Where the data is', text: 'Saffire V and VI burned samples at reduced pressure and raised oxygen inside uncrewed Cygnus ships: about 10 psi and 26% O₂ on V, and about 8 psi and 29–31% O₂ on VI. They are on our list to add.', source: SOURCES.saffire });
    if (!has('gravity')) gaps.push({ topic: 'Where the data is', text: 'SoFIE, in the station’s Combustion Integrated Rack, can test exploration atmospheres at reduced pressure.', source: SOURCES.sofie });
  }
  if (has('airflow')) {
    if (check('airflow').status === 'unrecorded') gaps.push({ topic: 'Airflow', text: 'The report gives these tests’ airflow only as an instrument reading, not in cm/s, so it can’t be matched to yours.', source: set.source });
    else if (s.airflow < E.flowMin) {
      gaps.push({ topic: 'Airflow', text: `Still air is its own regime. With no flow, oxygen reaches a flame only by slow diffusion, and every one of these tests had at least ${E.flowMin} cm/s of airflow.`, source: SOURCES.candle });
      if (set.id === 'pmma') {
        const [hi, lo] = [...EXTINCTION].sort((a, b) => b.o2 - a.o2);
        gaps.push({ topic: 'Airflow', text: `In BASS-II’s thin-acrylic tests, flames went out once the opposing airflow fell below ${hi.experimentMmS / 10} ± ${hi.uncertaintyMmS / 10} cm/s at ${hi.o2}% O₂, and ${lo.experimentMmS / 10} ± ${lo.uncertaintyMmS / 10} cm/s at ${lo.o2}%. The report says that speed doesn’t depend on thickness.`, source: SOURCES.extinction });
      } else {
        const quenched = set.rows.filter(t => t.outcome === 'quenched').map(t => t.flowMin);
        if (quenched.length) gaps.push({ topic: 'Airflow', text: `In ${quenched.length} of these fabric tests, the flame went out as the airflow was turned down, at ${range(Math.min(...quenched), Math.max(...quenched), ' cm/s')}.`, source: set.source });
      }
    } else if (s.airflow > E.flowMax) gaps.push({ topic: 'Airflow', text: `Flows above ${E.flowMax} cm/s weren’t tested in this set.`, source: set.source });
    else if (set.id === 'pmma') gaps.push({ topic: 'Airflow', text: `BASS-II set each acrylic test’s airflow to fixed values: ${E.flows.join(', ')} cm/s. None was set to ${s.airflow} cm/s. The nearest settings were ${list(neighbours(set, s.airflow))}, and this app doesn’t fill the gap between them.`, source: set.source });
    else gaps.push({ topic: 'Airflow', text: `No test in this set ran at ${s.airflow} cm/s, held or passed through.`, source: set.source });
  }
  if (has('thickness')) gaps.push(check('thickness').status === 'unrecorded'
    ? { topic: 'Thickness', text: 'The report doesn’t record these samples’ thickness, so no thickness can be matched.', source: set.source }
    : { topic: 'Thickness', text: `BASS-II tested ${E.thicknesses.join(', ')} mm sheets. Thinner sheets spread faster in these tests, so the data doesn’t support stretching it to ${s.thickness} mm.`, source: SOURCES.report });
  if (has('width')) gaps.push(check('width').status === 'unrecorded'
    ? { topic: 'Width', text: 'The report doesn’t record these samples’ width, so no width can be matched.', source: set.source }
    : { topic: 'Width', text: `These tests used ${list(E.widths.map(w => `${w / 10} cm`))} wide samples, so ${s.width / 10} cm wasn’t tested.`, source: set.source });
  for (const u of s.unrecorded || []) if (has(u.key)) gaps.push({ topic: u.label, text: `${u.label} isn’t recorded in these tables, so ${u.value} can’t be matched to any test.`, source: set.source });
  if (has('together')) {
    const names = { oxygen: `${s.air.o2}% oxygen`, airflow: `${s.airflow} cm/s`, thickness: `${s.thickness} mm sheets`, width: `${s.width / 10} cm wide samples` };
    const where = A.given.map(k => `${names[k]}: ${list(A.coverage[k])}`).join('. ');
    gaps.push({ topic: 'Together', text: A.untied
      ? `Table 5.1 gives each test’s oxygen only at its start and end. A test can pass through your oxygen level and also run at your airflow, but the table can’t say they happened at the same time. ${where}.`
      : `Each condition appears in some tests, but no single test had all of them. In BASS-II, conditions changed together from test to test, so a combination has to be checked against each test’s own row. ${where}.`, source: set.source });
  }
  return gaps;
}

const combos = (xs, n) => n === 0 ? [[]] : xs.flatMap((x, i) => combos(xs.slice(i + 1), n - 1).map(c => [x, ...c]));

// The fewest changes that land on matching tests: fix set-level gaps first, then drop as few conditions as possible.
function nearestFor(s, A) {
  const params = {}, changes = [], left = [];
  let base = { ...s, unrecorded: [] };
  if (A.failed.includes('material')) {
    params.material = ['cotton', 'fabric'].includes(s.material.id) ? 'sibal' : 'pmma';
    const m = MATERIALS.find(x => x.id === params.material);
    changes.push(m.id === 'sibal' ? 'SIBAL fabric' : 'acrylic');
    base = { ...base, material: { id: m.id, name: m.name, inline: m.inline, supported: true } };
  }
  if (A.failed.includes('gravity')) {
    params.mission = 'iss'; params.air = 'earth'; changes.push('the ISS', 'Earth-normal air');
    base = { ...base, mission: { ...MISSIONS[0], supported: true }, air: stationAir() };
  } else if (A.failed.includes('pressure') || (A.failed.includes('oxygen') && !s.air.explicitO2)) {
    params.air = 'earth'; changes.push('Earth-normal air');
    base = { ...base, air: stationAir() };
  }
  if (s.unrecorded?.length) left.push(...s.unrecorded.map(u => u.label.toLowerCase()));

  const T = ENVELOPE.thicknesses;
  const nearestT = base.material.id === 'pmma' && s.thickness !== null && !T.includes(s.thickness)
    ? T.reduce((a, x) => Math.abs(x - s.thickness) < Math.abs(a - s.thickness) ? x : a) : null;
  const drop = { oxygen: b => ({ ...b, air: stationAir() }), airflow: b => ({ ...b, airflow: null }), width: b => ({ ...b, width: null }),
    thickness: b => ({ ...b, thickness: nearestT }) };
  const keys = applicability(base).given;
  const fix = [[], ...keys.flatMap((_, n) => combos(keys, n + 1))]
    .find(sub => applicability(sub.reduce((b, k) => drop[k](b), base)).covered) ?? keys;
  for (const k of fix) {
    if (k === 'oxygen') { if (!params.air) { params.air = 'earth'; changes.push('Earth-normal air'); } }
    else if (k === 'airflow') { params.airflow = 'none'; changes.push('any tested airflow'); }
    else if (k === 'width') { params.width = 'all'; changes.push('any tested width'); }
    else { params.thickness = nearestT ?? 'all'; changes.push(nearestT === null ? 'any thickness' : `${nearestT} mm sheets`); }
  }
  const text = [changes.length && `Switches to ${list(changes)}.`, left.length && `Leaves out ${list(left)}.`].filter(Boolean).join(' ');
  return { label: 'Show the nearest evidence we have', changes: text, params };
}

// ---------- Evidence and verdicts ----------
function evidenceFor(s, A) {
  const matched = A.matched, readings = matched.flatMap(r => readingsFor(r, s)), tracked = readings.filter(p => p.spread !== null);
  const fastest = tracked.length ? tracked.reduce((a, b) => b.spread > a.spread ? b : a) : null;
  const slowest = tracked.length ? tracked.reduce((a, b) => b.spread < a.spread ? b : a) : null;
  const burn = matched.map(r => r.burnMin), ids = matched.map(r => r.id);
  let finding;
  if (!A.given.length) {
    const maxFor = t => Math.max(...A.set.rows.filter(r => r.thicknessMm === t && r.spread).flatMap(r => r.spread));
    const thin = ENVELOPE.thicknesses[0], thick = ENVELOPE.thicknesses.at(-1), f1 = maxFor(thin), f5 = maxFor(thick);
    finding = { lead: 'Thin sheets spread faster.', text: `The fastest ${thin} mm sheet moved ${Math.round(f1 / f5)}× faster than any ${thick} mm sheet (${f1} vs ${f5} mm/s).` };
  } else if (!tracked.length) finding = { lead: 'Spread not tracked.', text: `${list(ids)} burned, but the report didn’t track the spread at these conditions.` };
  else {
    const flows = sorted(tracked.map(p => p.velocity));
    finding = A.given.length === 1 && A.given[0] === 'thickness'
      ? { lead: `${s.thickness} mm sheets`, text: `spread at ${range(slowest.spread, fastest.spread)} mm/s across ${range(flows[0], flows.at(-1), ' cm/s')} of airflow.` }
      : { lead: `The ${plural(matched.length, 'matching test')}`, text: `spread at ${range(slowest.spread, fastest.spread)} mm/s in ${plural(tracked.length, 'tracked reading')} at ${range(flows[0], flows.at(-1), ' cm/s')}.` };
  }
  const o2Note = s.air.explicitO2 ? ` Oxygen fell during each test and the table gives only its start and end, so each matching test passed through ${s.air.o2}% at some point during its burn.` : '';
  return { kind: 'spread', thickness: s.thickness, airflow: s.airflow, ids, readings,
    stats: { tests: matched.length, notTracked: matched.filter(r => !readingsFor(r, s).some(p => p.spread !== null)).length, burnMin: Math.min(...burn), burnMax: Math.max(...burn), fastest, slowest },
    finding, caveat: `Descriptive, not a safety rating. Sheet width, burning sides and oxygen also change between tests.${o2Note}` };
}

// What happened to each fabric or Nomex sample, in words, from the report's own comment or note.
const HAPPENED = {
  burned: 'Burned', quenched: 'Burned, then went out as the airflow was turned down', blowoff: 'Burned, then blew out as the airflow was turned up',
  'no-ignition': 'Didn’t ignite'
};
const AT_FLOW = { burned: 'Burning at this airflow', quenched: 'Went out as the airflow reached this speed', blowoff: 'Blew out as the airflow reached this speed', 'no-ignition': 'Didn’t ignite' };

function outcomesFor(s, A) {
  const set = A.set, tests = A.matched, v = set.id === 'sibal' ? s.airflow : null;
  const at = t => v === null ? t.outcome : outcomeAt(t, v);
  const count = o => tests.filter(t => at(t) === o).length;
  const burned = count('burned'), quenched = count('quenched'), blowoff = count('blowoff'), noIgnition = count('no-ignition');
  const rows = tests.map(t => set.id === 'nomex'
    ? { id: t.id, date: t.date, flowText: `air display ${t.airDisplay}`, oxygenText: t.oxygenFinal === null ? `${t.oxygenInitial}% → not read` : `${t.oxygenInitial}% → ${t.oxygenFinal}%`, happened: t.notes, sourceLocation: t.sourceLocation }
    : { id: t.id, width: `${t.widthMm / 10} cm`, flowText: `${t.flowText} cm/s`, oxygenText: `${t.oxygen}%${t.oxygenNote ? '*' : ''}`, happened: HAPPENED[t.outcome],
        atYourAirflow: v === null ? null : AT_FLOW[at(t)], sourceLocation: t.sourceLocation, oxygen: t.oxygen, outcome: t.outcome });
  const finding = set.id === 'nomex'
    ? { lead: 'The report:', text: '“The three Nomex® samples did not ignite …” Each row shows the test’s own note.' }
    : { lead: 'The report found:', text: '“Flames spread more slowly across the narrower samples, at lower flow velocities and at lower O2 percentages.” (p. 95)' };
  const caveat = set.id === 'nomex'
    ? 'Descriptive, not a safety rating. The airflow ran with the flame, and the report gives its speed only as an instrument reading.'
    : `Descriptive, not a safety rating. The airflow in these tests ran with the flame, not against it as in the acrylic tests. ${set.excluded} reused samples are left out, as the report does. * The report says this O₂ reading might be inaccurate.`;
  // Without an airflow, a sample that ignited counts as burned even if the flow later put it out; at an airflow, only a flame present at that flow does.
  const ignited = v === null ? tests.length - noIgnition : burned;
  return { kind: 'outcomes', set: set.id, label: set.tested, airflow: v, ids: tests.map(t => t.id), tests: rows,
    counts: { tests: tests.length, ignited, burned, quenched, blowoff, noIgnition }, finding, caveat, source: set.source };
}

function burnedVerdict(s, A) {
  const n = A.matched.length, burn = A.matched.map(r => r.burnMin), onlyThickness = A.given.length === 1 && A.given[0] === 'thickness';
  const minutes = n === 1 ? `for ${Math.round(burn[0])} minutes` : `for ${Math.round(Math.min(...burn))} to ${Math.round(Math.max(...burn))} minutes each`;
  const who = !A.given.length ? `All ${n} acrylic sheets in the BASS-II tests burned in orbit`
    : onlyThickness ? `All ${n} of the ${s.thickness} mm sheets in the BASS-II tests burned in orbit`
    : n === 1 ? `The one BASS-II acrylic test that recorded your conditions, ${A.matched[0].id}, burned in orbit`
    : `All ${n} BASS-II acrylic tests that recorded your conditions burned in orbit`;
  return { state: 'burned', stamp: 'Burned', count: A.given.length ? `${n} of ${n} matching tests` : `${n} of ${n} tests`,
    headline: s.safety ? 'NASA watched it burn.' : 'Yes. NASA watched it burn.',
    sub: `${who}, ${minutes}.${s.mission.id === 'transit' ? ' On this trip, Earth is months away.' : ''}` };
}

function outcomeVerdict(ev, E, s) {
  const { tests: n, ignited, quenched, blowoff, noIgnition } = ev.counts, v = ev.airflow;
  const at = v === null ? '' : ` at ${v} cm/s`, tries = n === 1 ? 'try' : 'tries';
  const events = [quenched && `${quenched} went out as the airflow was turned down${v === null ? '' : ` to ${v} cm/s`}`,
    blowoff && `${blowoff} blew out as it was turned up${v === null ? '' : ` to ${v} cm/s`}`].filter(Boolean);
  const eventText = events.length ? ` ${events.join(', and ')}.` : '';
  const matchWord = s.air.explicitO2 || s.airflow !== null || s.width !== null ? 'matching tests' : 'tests';
  if (ignited === n) return { state: 'burned', stamp: 'Burned', count: `${n} of ${n} ${matchWord}`, headline: s.safety ? 'NASA watched it burn.' : 'Yes. NASA watched it burn.',
    sub: `All ${n} ${ev.label} tests here burned in orbit${at}.${v === null ? eventText : ''}` };
  if (ignited === 0) {
    const why = ev.set === 'nomex' ? `${n} small samples, one igniter, airflow running with the flame and ${range(E.o2Min, E.o2Max, '% oxygen')} are all that was tested.`
      : [noIgnition && `${noIgnition} didn’t ignite`, ...events].filter(Boolean).join(', and ') + '.';
    return { state: 'no-burn', stamp: 'No flame held', count: `0 of ${n} ${matchWord}`,
      // A safety question never gets an opening that reads as yes or no ("No flame held…" could read as "No, not safe").
      headline: s.safety ? `In NASA’s ${n} ${tries}${at}, no flame held on it.` : v !== null ? `No flame held${at} in NASA’s ${n} ${tries}.` : `Not in NASA’s tests. No flame held on it in ${n} ${tries}.`,
      sub: `That isn’t a safety rating: ${why}` };
  }
  const o2 = ev.tests.filter(t => t.outcome === 'no-ignition').map(t => t.oxygen);
  return { state: 'mixed', stamp: 'Mixed', count: `${ignited} of ${n} ${matchWord} burned`,
    headline: `${s.safety ? '' : 'Sometimes. '}NASA saw it burn in ${ignited} of ${n} tests${at}.`,
    sub: `${noIgnition ? `The ${noIgnition} that didn’t ignite ${noIgnition === 1 ? 'was' : 'were'} at ${range(Math.min(...o2), Math.max(...o2), '%')} oxygen.` : ''}${eventText}`.trim() };
}

// The home-page tap that replaces each unreadable condition. Thickness chips exist only for acrylic, and a number
// the app couldn't place has no tap at all.
const TAP_FOR = { o2: 'the cabin air', psi: 'the cabin air', thickness: 'a thickness', gravity: 'a mission' };
function unresolvedVerdict(s) {
  const { unresolved } = s;
  const taps = [...new Set(unresolved.map(u => u.key === 'thickness' && s.material.id !== 'pmma' ? undefined : TAP_FOR[u.key]))];
  const how = taps.every(Boolean) ? `Reword the question, or tap ${taps.join(' and ')} to replace ${unresolved.length > 1 ? 'them' : 'it'}.` : 'Reword the question to get an answer.';
  return { state: 'unresolved', stamp: 'Unclear', count: 'Not answered', headline: `Unclear. ${unresolved[0].reason}`,
    sub: `This app won’t guess a value you didn’t give. ${how}` };
}

function canonicalFor(s) {
  const what = s.material.id === 'pmma' ? (s.thickness !== null ? `a ${s.thickness} mm acrylic sheet` : 'acrylic') : s.material.inline;
  // Conditions no table records stay in the question, so it never drops something the answer used.
  const extra = Object.fromEntries((s.unrecorded || []).map(u => [u.key, u.value]));
  const sizes = [s.width !== null && `${s.width / 10} cm wide`, extra.length].filter(Boolean);
  const wide = sizes.length ? `, ${sizes.join(', ')},` : '';
  const said = `${extra.temperature ? ` at ${extra.temperature}` : ''}${extra.humidity ? ` with ${extra.humidity} humidity` : ''}`;
  const { explicitO2, explicitPsi, o2, psi, preset } = s.air;
  const air = !explicitO2 && !explicitPsi ? AIRS[preset].phrase
    : `at ${[explicitO2 && `${o2}% oxygen`, explicitPsi && `${psi} psi`].filter(Boolean).join(' and ')}${!explicitPsi && preset !== 'earth' ? ` in ${AIRS[preset].name.toLowerCase()} air` : ''}`;
  const flow = s.airflow === null ? '' : s.airflow === 0 ? ' with no airflow' : ` with ${s.airflow} cm/s of airflow`;
  return `Will ${what}${wide} burn ${s.mission.phrase} ${air}${flow}${said}?`;
}

// A field that couldn't be read shows only as Unclear, never beside the default that would have stood in for it.
const SHOWN_AS = { o2: 'air', psi: 'air', thickness: 'thickness', width: 'width', airflow: 'airflow', gravity: 'mission' };
function understoodFor(s) {
  const unclear = new Set(s.unresolved.map(u => SHOWN_AS[u.key]));
  return [
    { key: 'mission', field: 'Mission', value: s.mission.name, from: s.from.mission },
    { key: 'air', field: 'Cabin air', value: `${s.air.name} · ${s.air.psi} psi · ${s.air.o2}% O₂`, from: s.from.air },
    { key: 'material', field: 'Material', value: s.material.name, from: s.from.material },
    { key: 'thickness', field: 'Thickness', value: s.thickness === null ? 'All sheets' : `${s.thickness} mm`, from: s.from.thickness },
    ...(s.width !== null ? [{ key: 'width', field: 'Width', value: `${s.width / 10} cm`, from: s.from.width }] : []),
    { key: 'airflow', field: 'Airflow', value: s.airflow === null ? 'Any tested' : s.airflow === 0 ? 'Still air' : `${s.airflow} cm/s`, from: s.from.airflow }
  ].filter(r => !unclear.has(r.key)).map(({ key, ...r }) => r).concat(
    (s.unrecorded || []).map(u => ({ field: u.label, value: u.value, from: 'question' })),
    s.unresolved.map(u => ({ field: u.label, value: 'Unclear', from: 'unresolved' })));
}

/** The single entry point behind GET /api/ask and the MCP tool will_it_burn. */
export function ask(params = {}) {
  const s = resolveScenario(params), A = applicability(s), set = A.set;
  const unclear = s.unresolved.length > 0, covered = A.covered && !unclear;
  const evidence = covered ? (set.kind === 'spread' ? evidenceFor(s, A) : outcomesFor(s, A)) : null;
  const verdict = unclear ? unresolvedVerdict(s)
    : !covered ? { state: 'no-data', stamp: 'No data', count: `0 of ${set.rows.length} tests match`, headline: headlineFor(s, A),
        sub: A.closest.length ? 'That is an answer too. The closest tests are listed below, with what each one recorded.'
          : 'That is an answer too: NASA’s tests in this set don’t reach your cabin. Each gap says what is missing and where data may exist.' }
    : set.kind === 'outcomes' ? outcomeVerdict(evidence, set.envelope, s) : burnedVerdict(s, A);
  const gaps = covered || unclear ? [] : gapsFor(s, A);
  const sources = [set.source, ...gaps.map(g => g.source)].filter((x, i, a) => a.findIndex(y => y.url === x.url && y.name === x.name) === i);

  return {
    question: params.q || '',
    canonical: unclear ? String(params.q ?? '') : canonicalFor(s),
    notices: s.parsed.notices,
    unresolved: s.unresolved,
    understood: understoodFor(s),
    scenario: { mission: s.mission, air: s.air, material: s.material, thickness: s.thickness, width: s.width, airflow: s.airflow },
    // Each tile's badge: how many tests match that mission with its own default air and the current other
    // conditions. The selected tile uses the current air.
    missions: MISSIONS.map(m => {
      const alt = m.id === s.mission.id ? A : applicability({ ...s, mission: { ...m, supported: true }, air: airFor(AIRS[m.air].psi, AIRS[m.air].o2, m.air) });
      return { id: m.id, name: m.name, sub: m.sub, gText: m.gText, home: m.home, matches: alt.covered ? alt.matched.length : 0, selected: m.id === s.mission.id };
    }),
    checks: A.checks.map(c => ({ key: c.key, label: c.label, yours: c.yours, tested: c.tested, status: c.status,
      statusLabel: c.key === 'together' ? 'Not in one test' : STATUS_LABEL[c.status], ok: c.ok, note: c.note ?? null })),
    verdict,
    why: covered && set.id === 'pmma' ? { lead: 'Passing on Earth isn’t proof for orbit.', text: 'Related BASS-II tests kept acrylic rods burning at 17% O₂ in orbit. On the ground, rods of the same sizes couldn’t keep a flame at 18% or below.', source: SOURCES.gravityRods } : null,
    evidence,
    // Ranked over all 20 acrylic tests, and shown beside an answer only when acrylic tests match it.
    findings: covered && set.id === 'pmma' ? FINDINGS : null,
    // Saffire-II sits beside the answer, never inside it: a separate rig, flow direction and O₂ method.
    related: covered ? saffireRelated(set.id) : null,
    // Tests that recorded some of your conditions but not all: visible, never counted as a match.
    closest: !covered && !unclear && A.closest.length ? { set: set.id, tests: A.closest } : null,
    gaps, nearest: covered || unclear ? null : nearestFor(s, A),
    applicability: { policy: POLICY, matched: A.matched.map(r => r.id), given: A.given },
    envelope: set.envelope, sources
  };
}
