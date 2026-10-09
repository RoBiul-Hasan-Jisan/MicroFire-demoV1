// Ranked findings: what the BASS-II rows show, ordered by how consistently pairs of spread readings agree.
// Airflow pairs two readings from inside one test. Every other factor pairs readings from two different tests that
// share the conditions that factor lists; starting oxygen is matched only by the oxygen finding itself.
// A test can sit in many pairs, so pair counts are not independent replications, and the tiers are this app's
// display rule, not a statistical test. Counts, exceptions and caveats all come from the rows. No causal claim,
// no safety ranking.
import { records } from './evidence.mjs';

export const TIERS = { consistent: 'Consistent', suggestive: 'Suggestive', mixed: 'Mixed', 'too-few': 'Too few pairs' };
export const RULE = 'This is the app’s display rule, not a statistical test. Consistent: 10 or more reading pairs, at least 85% agreeing. Suggestive: 4 or more, at least 75%. Mixed: 4 or more, under 75%. Too few pairs: under 4.';

export function tierFor(n, agree) {
  if (n >= 10 && agree / n >= 0.85) return 'consistent';
  if (n >= 4) return agree / n >= 0.75 ? 'suggestive' : 'mixed';
  return 'too-few';
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const list = xs => xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
const byId = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const idsOf = pairs => [...new Set(pairs.flatMap(p => [p.a.id, p.b.id]))].sort(byId);
const order = v => v.every((x, i) => i === 0 || x < v[i - 1]) ? 'down' : v.every((x, i) => i === 0 || x > v[i - 1]) ? 'up' : 'mixed';

// Each factor: the condition that varies, the conditions that must match, what is left unmatched, and the side its
// lead expects to spread faster.
const pairsText = (n, a, t) => `in ${a} of ${plural(n, 'reading pair')}, from ${plural(t, 'test')}`;
const FACTORS = [
  { key: 'airflow', topic: 'Airflow.', lead: 'More airflow, faster spread.', varies: 'velocity', matched: [], sameTest: true, favoured: (p, q) => p.velocity > q.velocity,
    matchedOn: ['the same test'], notMatched: ['oxygen at each reading'],
    text: (n, a, t) => `Inside single tests, the faster airflow had the faster spread ${pairsText(n, a, t)}.` },
  { key: 'thickness', topic: 'Thickness.', lead: 'Thinner sheets, faster spread.', varies: 'thickness', matched: ['width', 'sides', 'velocity'], favoured: (p, q) => p.thickness < q.thickness, other: 'thicker sheet',
    matchedOn: ['width', 'burning sides', 'airflow'], notMatched: ['oxygen'],
    text: (n, a, t) => `Between tests with the same width, burning sides and airflow, but not the same oxygen, the thinner sheet spread faster ${pairsText(n, a, t)}.` },
  { key: 'width', topic: 'Width.', lead: 'Wider sheets, faster spread.', varies: 'width', matched: ['thickness', 'sides', 'velocity'], favoured: (p, q) => p.width > q.width, other: 'narrower sheet',
    matchedOn: ['thickness', 'burning sides', 'airflow'], notMatched: ['oxygen'],
    text: (n, a, t) => `Between tests with the same thickness, burning sides and airflow, but not the same oxygen, the wider sheet spread faster ${pairsText(n, a, t)}.` },
  { key: 'oxygen', topic: 'Oxygen.', lead: 'More oxygen, faster spread.', varies: 'oxygen', matched: ['thickness', 'width', 'sides', 'velocity'], favoured: (p, q) => p.oxygen > q.oxygen,
    matchedOn: ['thickness', 'width', 'burning sides', 'airflow'], notMatched: ['oxygen during the burn (only the start is compared)'],
    text: (n, a, t) => `Between tests with the same thickness, width, burning sides and airflow, the one that started with more oxygen spread faster ${pairsText(n, a, t)}.` },
  { key: 'sides', topic: 'Burning sides.', lead: 'Two burning sides, faster spread.', varies: 'sides', matched: ['thickness', 'width', 'velocity'], favoured: (p, q) => p.sides > q.sides, other: 'one-sided sheet',
    matchedOn: ['thickness', 'width', 'airflow'], notMatched: ['oxygen'],
    text: (n, a, t) => `Between tests with the same thickness, width and airflow, but not the same oxygen, the two-sided sheet spread faster ${pairsText(n, a, t)}.` }
];

// Every tracked (airflow, spread) reading, with the conditions of its test. Untracked spreads never appear.
const points = rs => rs.flatMap(r => (r.spread || []).map((spread, i) => ({ id: r.id, velocity: r.velocity[i], spread,
  thickness: r.thicknessMm, width: r.widthMm, sides: r.burningSides, oxygen: r.oxygenInitial })));

function pairsFor(f, pts) {
  const pairs = [];
  pts.forEach((p, i) => pts.slice(i + 1).forEach(q => {
    if ((p.id === q.id) !== !!f.sameTest || p[f.varies] === q[f.varies] || f.matched.some(k => p[k] !== q[k])) return;
    const [a, b] = f.favoured(p, q) ? [p, q] : [q, p];   // a is the side the lead expects to spread faster
    pairs.push({ a, b, agrees: a.spread > b.spread });
  }));
  return pairs;
}

// The test that sits in the most pairs: pairs reuse readings, so they are never independent results.
function busiestOf(pairs) {
  const count = new Map();
  for (const p of pairs) for (const id of new Set([p.a.id, p.b.id])) count.set(id, (count.get(id) || 0) + 1);
  const [id, n] = [...count].sort((x, y) => y[1] - x[1] || byId(x[0], y[0]))[0] ?? [null, 0];
  return { id, pairs: n };
}

function caveatFor(f, pairs, rs) {
  const misses = pairs.filter(p => !p.agrees), o2Fell = rs.every(r => r.oxygenFinal < r.oxygenInitial), busiest = busiestOf(pairs);
  const reuse = pairs.length > 1 && busiest.pairs > 1 ? ` The ${pairs.length} pairs reuse readings, so they aren’t ${pairs.length} independent results: ${busiest.id} is in ${busiest.pairs} of them.` : '';
  if (f.key === 'airflow') {
    const exceptions = idsOf(misses);
    const notDown = rs.filter(r => r.spread?.length > 1 && order(r.velocity) !== 'down');
    let text = `Airflow wasn’t varied on its own. ${o2Fell ? 'Oxygen fell during every test, and the table' : 'The table'} gives only start and end oxygen, so it can’t separate airflow from falling oxygen.`;
    if (exceptions.length && exceptions.join() === notDown.map(r => r.id).sort(byId).join() && notDown.every(r => order(r.velocity) === 'up'))
      text += exceptions.length === 1 ? ` The one exception, ${exceptions[0]}, is also the only test listed from low to high flow.`
        : ` The exceptions, ${list(exceptions)}, are also the only tests listed from low to high flow.`;
    else if (exceptions.length) text += ` Exceptions: ${list(exceptions)}.`;
    return text + reuse;
  }
  if (f.key === 'oxygen') return `Uses each test’s starting oxygen${o2Fell ? ', which fell during every test' : ''}.${reuse}`;
  const base = 'Oxygen isn’t matched: these are different tests, and their oxygen differs.';
  if (!misses.length || !misses.every(p => p.b.oxygen > p.a.oxygen)) return base + reuse;
  return `${base} ${misses.length === 1 ? 'The one exception' : `All ${misses.length} exceptions`} had more starting oxygen on the ${f.other}.${reuse}`;
}

/** Ranks every factor by tier, then by the share of pairs that agree, then by how many pairs there are. */
export function rankFindings(rs = records) {
  const pts = points(rs), tiers = Object.keys(TIERS), share = f => f.comparisons ? f.agree / f.comparisons : 0;
  const found = FACTORS.map(f => {
    const pairs = pairsFor(f, pts), n = pairs.length, agree = pairs.filter(p => p.agrees).length, tier = tierFor(n, agree), ids = idsOf(pairs);
    const side = p => ({ id: p.id, velocity: p.velocity, spread: p.spread, [f.varies]: p[f.varies] });
    return { key: f.key, tier, tierLabel: TIERS[tier], lead: tier === 'consistent' || tier === 'suggestive' ? f.lead : f.topic,
      text: n ? f.text(n, agree, ids.length) : 'No matched reading pairs in these tests.', caveat: caveatFor(f, pairs, rs),
      comparisons: n, agree, tests: ids.length, ids, matchedOn: f.matchedOn, notMatched: f.notMatched, busiest: busiestOf(pairs),
      exceptions: idsOf(pairs.filter(p => !p.agrees)),
      pairs: pairs.map(p => ({ expected: side(p.a), other: side(p.b), agrees: p.agrees })) };
  });
  const untracked = rs.filter(r => !r.spread).map(r => r.id);
  return {
    tests: rs.length,
    method: 'Each finding compares pairs of spread readings. The airflow finding pairs two readings from inside one test. The others pair readings from two different tests that share the conditions each one names; apart from the oxygen finding, oxygen is not matched, since it differs between tests and fell during each burn. A test can sit in many pairs, so pair counts are not independent replications.' +
      (untracked.length ? ` ${list(untracked)} ${untracked.length === 1 ? 'has no tracked spread, so it is' : 'have no tracked spread, so they are'} left out, never counted as zero.` : ''),
    rule: RULE,
    caveat: 'Descriptive, not causal, and not a safety ranking. All rows come from one NASA investigation, so they are not independent studies.',
    ranked: found.sort((x, y) => tiers.indexOf(x.tier) - tiers.indexOf(y.tier) || share(y) - share(x) || y.comparisons - x.comparisons)
      .map((f, i) => ({ rank: i + 1, ...f }))
  };
}

export const FINDINGS = rankFindings();
