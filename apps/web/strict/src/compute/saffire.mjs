// Saffire-II (PSI-99), read from NASA's own table in data/psi-99-saffire-2.csv. It's a separate, larger
// experiment (Cygnus, 29 cm samples, flow running with the flame, O₂ derived from CO₂), so its results sit
// beside an answer as "also seen in another experiment" and never join a verdict.
import { readFileSync } from 'node:fs';
import { tableFrom } from './csv.mjs';

export const saffireProvenance = JSON.parse(readFileSync(new URL('../../data/psi-99-saffire-2.provenance.json', import.meta.url)));
const table = tableFrom(readFileSync(new URL('../../data/psi-99-saffire-2.csv', import.meta.url), 'utf8'));
const col = start => table.columns.find(c => c.startsWith(start));
const id = r => r[col('Sample Number')];

// "Note 2 The PMMA portion …" becomes { 2: "The PMMA portion …" }, word for word.
export const saffireNotes = Object.fromEntries(table.rows.filter(r => /^Note \d/.test(id(r))).map(r => [id(r).match(/^Note (\d+)/)[1], id(r).replace(/^Note \d+\s*/, '')]));

let lastMaterial = null;
export const saffireSamples = table.rows.filter(r => /^2-\d+$/.test(id(r))).map(r => {
  lastMaterial = r[col('Material')] ?? lastMaterial;   // a blank material repeats the row above, as the table is laid out
  const ug = r[col('?-g Burn Length')] ?? '', spread = r[col('?-g Spread Length')] ?? '', oneG = r[col('1-g Burn Length')] ?? '';
  return { sample: id(r), material: lastMaterial, flow: r[col('Air Flow')], direction: r[col('Flow Direction')], oxygen: r[col('Percent O2')],
    microgravityBurnLength: ug, oneGBurnLength: oneG,
    microgravityNoSpread: /^~?\s*0$/.test(ug), oneGBurned: oneG === 'Complete' || /^\d+(\.\d+)?\s*cm$/.test(oneG),
    spreadMmS: /^\d+(\.\d+)?\s*mm\/s$/.test(spread) ? parseFloat(spread) : null };
});

const source = { label: `Saffire-II, ${saffireProvenance.investigation}`, name: saffireProvenance.title, url: saffireProvenance.source };
const of = re => saffireSamples.filter(s => re.test(s.material));
const lead = 'Saffire-II, a separate and larger experiment,';

/** One "also seen in another experiment" line for a material, computed from NASA's table, or null. */
export function saffireRelated(material) {
  if (material === 'silicone') {
    const s = of(/^Silicone$/), none = s.filter(x => x.microgravityNoSpread).length, ground = s.filter(x => x.oneGBurned).length;
    return { text: `${lead} tried to burn ${s.length} silicone samples in orbit. ${none === s.length ? 'None spread' : `${none} didn’t spread`}: NASA lists their burn length as about 0. On the ground, matching samples burned in ${ground} of ${s.length}.`, source };
  }
  if (material === 'sibal') {
    const s = of(/SIBAL/);
    return { text: `${lead} burned ${s.length} SIBAL strips ${s[0].microgravityBurnLength} long in orbit, spreading at ${s.map(x => x.spreadMmS).join(' and ')} mm/s with ${s[0].flow} of airflow running with the flame.`, source };
  }
  if (material === 'nomex') return { text: `${lead} also tried Nomex beside acrylic: “${saffireNotes[2]}”`, source };
  if (material === 'pmma') {
    const s = of(/^PMMA$/), complete = s.filter(x => x.oneGBurnLength === 'Complete').length;
    return { text: `${lead} burned thick acrylic in orbit, and NASA notes: “${saffireNotes[4]}”. On the ground, ${complete} of ${s.length} matching samples burned completely.`, source };
  }
  return null;
}
