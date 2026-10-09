// The fixed vocabulary of Will It Burn?: cited sources, missions, other places, cabin airs and materials.
// Nothing here is measured; it names things. Measurements live in data/ and are read by evidence.mjs and sets.mjs.
import { provenance } from './evidence.mjs';

export const SOURCES = {
  report: { name: 'NASA/TM-20210011385, Table 5.1, printed p. 57 (BASS-II)', url: provenance.source },
  fabric: { name: 'NASA/TM-20210011385, Table 7.1, printed p. 96 (BASS-II SIBAL fabric)', url: provenance.source },
  nomex: { name: 'NASA/TM-20210011385, Section 3.1.1 (p. 46) and Table A.2 (p. 105): the Nomex tests', url: provenance.source },
  extinction: { name: 'NASA/TM-20210011385, Table 2.1, printed p. 28 (extinction velocity)', url: provenance.source },
  gravityRods: { name: 'Scientific Reports (2018): The Effect of Gravity on Flame Spread over PMMA Cylinders', url: 'https://www.nature.com/articles/s41598-017-18398-4' },
  atmosphere: { name: 'NASA evidence report (2015): the 8.2 psia, 34% O₂ exploration atmosphere', url: 'https://ntrs.nasa.gov/citations/20150021491' },
  saffire: { name: 'NASA ICES-2024-365: Preliminary results from the Saffire VI experiment (Table 1)', url: 'https://ntrs.nasa.gov/citations/20240002981' },
  luci: { name: 'NASA (2025): Lunar Combustion Investigation (LUCI) on a spinning suborbital rocket', url: 'https://ntrs.nasa.gov/citations/20250010653' },
  sofie: { name: 'NASA Glenn: Solid Fuel Ignition and Extinction (SoFIE)', url: 'https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/solid-fuel-ignition-and-extinction-sofie/' },
  partialGravity: { name: 'Fire Safety Journal (2024): Partial gravity flammability of cast PMMA rods', url: 'https://www.sciencedirect.com/science/article/abs/pii/S0379711224001802' },
  candle: { name: 'NASA: Candle flame in 1g vs microgravity', url: 'https://www.nasa.gov/image-article/candle-flame-1g-vs-microgravity/' }
};

// The four mission tiles. Only microgravity (g = 0) is inside the NASA tests used here.
export const MISSIONS = [
  { id: 'iss', name: 'ISS', sub: 'Low Earth orbit', g: 0, gText: 'µg', gName: 'microgravity', home: 'Earth is hours away', air: 'earth',
    phrase: 'on the ISS', note: 'The station runs Earth-normal air.' },
  { id: 'moon', name: 'Moon base', sub: 'Artemis surface habitat', g: 0.166, gText: '0.17 g', gName: 'lunar gravity · 1/6 g', adj: 'lunar', home: 'Earth is days away', air: 'exploration',
    phrase: 'on a Moon base', note: 'NASA’s habitat concept: 8.2 psi at 34% O₂, so crews can start spacewalks quickly.' },
  { id: 'transit', name: 'Mars transit', sub: 'Deep-space cruise', g: 0, gText: 'µg', gName: 'microgravity', home: 'Earth is months away', air: 'earth',
    phrase: 'on the way to Mars', note: 'Cabin air isn’t chosen yet. Flip it and watch the evidence change.' },
  { id: 'mars', name: 'Mars base', sub: 'Surface habitat', g: 0.38, gText: '0.38 g', gName: 'Martian gravity', adj: 'Martian', home: 'Earth is months away', air: 'exploration',
    phrase: 'on a Mars base', note: 'Assumes the same exploration air as the Moon base.' }
];

// Places a question can name that none of these tests reached. They never fall back to a mission tile.
const tidy = s => String(s ?? '').replace(/[^\p{L}\p{N} .\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 30);
export function placeFor(id, name = '', g = null) {
  if (id === 'earth') return { id: 'earth', name: 'Earth', sub: 'Earth’s surface', g: 1, gText: '1 g', gName: 'Earth gravity', home: '',
    air: 'earth', phrase: 'on Earth', note: 'These NASA tests only ran in orbit.', supported: false };
  if (id === 'other') {
    const label = tidy(name) || (g !== null ? `${g} g` : 'Another world');
    return { id: 'other', name: label, sub: '', g, gText: g === null ? '?' : `${g} g`, gName: 'gravity not in this data', home: '',
      air: 'earth', phrase: /^\d/.test(label) ? `at ${label}` : `on ${label}`, note: 'None of these tests ran there.', supported: false };
  }
  return null;
}

export const AIRS = {
  earth: { key: 'earth', name: 'Earth-normal', psi: 14.7, o2: 21, phrase: 'in Earth-normal air' },
  exploration: { key: 'exploration', name: 'Exploration', psi: 8.2, o2: 34, phrase: 'in exploration air' }
};

// Order matters: the first tested material mentioned wins, otherwise the first untested one.
// SIBAL `covers` cotton and fabric, so "cotton-fiberglass fabric" doesn't trigger a notice about them.
export const MATERIALS = [
  { id: 'pmma', name: 'Acrylic (PMMA) sheet', inline: 'acrylic', supported: true, re: /acrylic|pmma|plexi(?:glass)?|perspex|polymethyl/ },
  { id: 'sibal', name: 'SIBAL cotton-fibreglass fabric', inline: 'SIBAL fabric', supported: true, covers: ['cotton', 'fabric'], re: /sibal|cotton[- /]?fib(?:er|re)[- ]?glass/ },
  { id: 'nomex', name: 'Nomex III', inline: 'Nomex', supported: true, re: /nomex/ },
  { id: 'cotton', name: 'Cotton fabric', inline: 'cotton fabric', re: /cotton/ },
  { id: 'fabric', name: 'Fabric', inline: 'fabric', re: /fabric|cloth|textile/ },
  { id: 'wire', name: 'Wire insulation', inline: 'wire insulation', re: /\bwires?\b|cable|insulation/ },
  { id: 'kapton', name: 'Kapton', inline: 'Kapton', re: /kapton|polyimide/ },
  { id: 'ptfe', name: 'Teflon (PTFE)', inline: 'Teflon', re: /teflon|ptfe/ },
  { id: 'ultem', name: 'Ultem', inline: 'Ultem', re: /ultem/ },
  { id: 'mylar', name: 'Mylar', inline: 'Mylar', re: /mylar/ },
  { id: 'paper', name: 'Paper', inline: 'paper', re: /paper|cardboard/ },
  { id: 'foam', name: 'Foam', inline: 'foam', re: /foam|polyurethane/ },
  { id: 'velcro', name: 'Velcro', inline: 'Velcro', re: /velcro/ },
  { id: 'nylon', name: 'Nylon', inline: 'nylon', re: /nylon/ },
  { id: 'silicone', name: 'Silicone', inline: 'silicone', re: /silicone/ },
  { id: 'fuel', name: 'Liquid or gas fuel', inline: 'liquid or gas fuel', re: /methane|ethanol|propane|hydrogen|jp-?8|kerosene|gasoline|\bfuel\b|droplet/ },
  { id: 'wax', name: 'Candle wax', inline: 'candle wax', re: /candle|\bwax\b/ }
];

// A material the catalog doesn't list, named in the question ("steel"). It is shown as asked and never becomes acrylic.
export function otherMaterial(name) {
  const clean = tidy(name).toLowerCase();
  if (!clean) return null;
  return { id: 'other', name: clean[0].toUpperCase() + clean.slice(1), inline: clean, supported: false };
}
