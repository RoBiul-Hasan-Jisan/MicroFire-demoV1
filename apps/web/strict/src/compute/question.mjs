// Reads a free-text question into cabin conditions, with rules rather than a language model.
// Each condition ends in one of four states, and none is ever swapped for a default behind the user's back:
//   given       fields[key]    a value the question states, in normalised units, even one no test covers
//   omitted     (absent)       the default applies and is shown as a default
//   unresolved  unresolved[]   malformed, contradictory, or in a unit the app can't convert: the app won't answer
//   unrecorded  unrecorded[]   clear, but a condition these tables never record (temperature, length, humidity)
// Every rule masks the words it reads, so no two rules read the same number, and a number no rule reads is
// unresolved: a value is never dropped on the way to an answer.
import { MATERIALS } from './catalog.mjs';
import { ENVELOPE } from './applicability.mjs';

const KPA_PER_PSI = 6.894757;
const round1 = x => Math.round(x * 10) / 10;
const exact = x => Math.round(x * 1e4) / 1e4;   // removes float noise from unit conversions, nothing more
const NUM = '(?<![\\d.]|\\d,)(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))(?![\\d.])';   // a whole number: "1-5 mm" is never -5 mm
const DASH = '\\s*-?\\s*';                                                  // "0.5-inch" reads like "0.5 inch"
const FRAC = '(\\d+)\\s*\\/\\s*(\\d+)';
const OTHER_GAS = '(?:co2|co\\b|carbon|nitrogen|n2\\b|helium|argon|water|h2o)';

// Unit factors, exact by definition.
const LENGTH_CM = { mm: 0.1, cm: 1, m: 100, km: 1e5, in: 2.54, ft: 30.48 };
const TIME_S = { s: 1, min: 60, h: 3600 };
const SPEED_CM_S = { mph: 44.704, kph: 1e5 / 3600, 'km/h': 1e5 / 3600, kmh: 1e5 / 3600, knot: 51.4444, knots: 51.4444, kn: 51.4444 };
const TO_PSI = { psi: 1, kpa: 1 / KPA_PER_PSI, pa: 1 / (KPA_PER_PSI * 1000), atm: 101.325 / KPA_PER_PSI, bar: 100 / KPA_PER_PSI,
  mbar: 0.1 / KPA_PER_PSI, hpa: 0.1 / KPA_PER_PSI, mmhg: 0.133322 / KPA_PER_PSI, torr: 0.133322 / KPA_PER_PSI };
const LENGTH_MM = { mm: 1, cm: 10, um: 0.001, in: 25.4 };

function unitOf(raw) {
  const u = raw.toLowerCase().replace(/\s+/g, '').replace(/\.$/, '');
  const names = [['mm', /^(?:mm|millimet(?:er|re)s?)$/], ['cm', /^(?:cm|centimet(?:er|re)s?)$/], ['m', /^(?:m|met(?:er|re)s?)$/],
    ['km', /^(?:km|kilomet(?:er|re)s?)$/], ['ft', /^(?:ft|feet|foot)$/], ['in', /^(?:in|inch(?:es)?|")$/], ['um', /^(?:µm|um|microns?|micromet(?:er|re)s?)$/],
    ['s', /^(?:s|secs?|seconds?)$/], ['min', /^(?:min|mins|minutes?)$/], ['h', /^(?:h|hr|hrs|hours?)$/], ['psi', /^psia?$/], ['atm', /^atm(?:ospheres?)?$/],
    ['mmhg', /^mmhg$/], ['kpa', /^kpa$/], ['hpa', /^hpa$/], ['mbar', /^mbar$/], ['bar', /^bar$/], ['pa', /^pa$/], ['torr', /^torr$/]];
  return names.find(([, re]) => re.test(u))?.[0] ?? null;
}

const LEAD = '(?:^|[,.:;!?]\\s*)(?:(?:so|and|but|ok|okay|hey|hi|please|then|tell me)[,!:]?\\s+)*';
const VERB = '(?:burn|catch(?:es)? (?:on )?fire|ignite|combust|keep burning|stay lit|be (?:safe|flammable|fire ?proof)|safe|flammable|fire ?proof|combustible|inflammable)';
const PATTERNS = {
  mission: {
    transit: /mars transit|(?:way|trip|journey|flight|travel(?:ling)?|cruise) to mars|\bto mars\b|in transit|deep[- ]space|\bcruise\b/,
    mars: /\bmars\b|martian|মঙ্গল/,
    moon: /\bmoon\b|lunar|artemis|চাঁদ|\b(?:one|a)[- ]sixth (?:of (?:the )?earth(?:'s|’s)? )?(?:g|gravity)\b/,
    iss: /\biss\b|space ?station|\b(?:aboard|on ?board) (?:the )?station\b|low[- ]earth orbit|\bleo\b|\borbit\b|microgravity|zero[- ]?g(?:ravity)?\b|\bno gravity\b|weightless|µg/,
    earth: /\bon (?:the )?earth\b|(?<!\bof (?:the )?)\bearth(?:'s|’s)? (?:gravity|surface)\b|\bon the ground\b|\bat sea level\b|\bnormal gravity\b|\bone g\b|(?<![\d.])1 ?g\b/,
    other: /\b(?:on|at|to|near|around|orbiting) (?:the )?(venus|mercury|jupiter|saturn|uranus|neptune|pluto|titan|europa|enceladus|ganymede|callisto|ceres|phobos|deimos|an asteroid|a comet|the sun)\b|\b((?:partial|reduced|low|lower|fractional|high|higher|hyper)[- ]?gravity)\b/
  },
  // A room on Earth is only a weak sign of place: "the lab module aboard the station" is still the station.
  room: /\bin (?:a|an|the|my|our) (?:lab|laboratory|building|house|home|kitchen|room|office|factory|car|plane|aircraft)\b(?! module)/,
  exploration: /exploration|high[- ]oxygen|oxygen[- ]rich|enriched|low[- ]pressure|reduced pressure/,
  earthAir: /earth[- ]normal|normal air|sea[- ]level|regular air|ordinary air|station air|iss air/,
  velocity: new RegExp(`${NUM}${DASH}(mm|millimet(?:er|re)s?|cm|centimet(?:er|re)s?|m|met(?:er|re)s?|km|kilomet(?:er|re)s?|ft|feet|foot|in(?:ch(?:es)?)?)\\s*(?:\\/|per|an?)\\s*(s|secs?|seconds?|min|mins|minutes?|h|hr|hrs|hours?)\\b|${NUM}${DASH}(mph|kph|km\\/h|kmh|knots?|kn)\\b`, 'g'),
  pressure: new RegExp(`${NUM}${DASH}(psia?|kpa|hpa|mbar|bar|pa|atm(?:ospheres?)?|mm ?hg|torr)\\b`, 'g'),
  oxygen: [new RegExp(`${NUM}\\s*(?:%|percent|per ?cent)\\s*(?:of\\s+)?\\b(?:o2|oxygen)`, 'g'),
    new RegExp(`\\b(?:o2|oxygen)[^\\d%]{0,15}?${NUM}\\s*(?:%|percent|per ?cent)(?!\\s*${OTHER_GAS})`, 'g')],
  percent: new RegExp(`${NUM}\\s*(?:%|percent|per ?cent)(?!\\s*(?:faster|slower|quicker|longer|shorter|more|less|higher|lower|of|chance|humidity|rh\\b|fans?|power|${OTHER_GAS}))`, 'g'),
  humidity: new RegExp(`${NUM}\\s*%\\s*(?:relative\\s+)?(?:humidity|rh\\b)|(?:humidity|\\brh\\b)\\D{0,12}?${NUM}\\s*%`, 'g'),
  temperature: new RegExp(`${NUM}\\s*(?:°\\s*|deg(?:rees?)?\\s*)(c|f|k)\\b|${NUM}\\s*(celsius|fahrenheit|kelvin)\\b`, 'g'),
  dimension: new RegExp(`${NUM}${DASH}(mm|millimet(?:er|re)s?|cm|centimet(?:er|re)s?|µm|um|microns?|micromet(?:er|re)s?|inch(?:es)?|in\\.|")(?:\\s*-?\\s*(thick(?:ness)?|wide|width|across|long|length|tall|high))?`, 'g'),
  gravity: new RegExp(`(?:at|in|under|of)\\s+(?:${FRAC}|${NUM})${DASH}g\\b|(?:${FRAC}|${NUM})${DASH}g\\s+(?:of\\s+)?gravity`),
  // A number after "airflow" or "pressure" with no unit the app can convert, such as "a flow of 0.3 cm".
  bareFlow: new RegExp(`(?:air ?flow|air ?speed|flow|wind|breeze|draft|ventilation|fans?)\\s*(?:speed\\s*)?(?:of|at|is|=|:)?\\s*${NUM}(?:\\s*(?:%|(?:mm|cm|m|km|ft|in(?:ch(?:es)?)?)\\b))?`),
  barePressure: new RegExp(`pressure\\s*(?:of|at|is|=|:)?\\s*${NUM}(?:\\s*%)?`),
  // Numbers that aren't cabin conditions: a comparison between results, a year, a mission's own number.
  comparison: new RegExp(`${NUM}${DASH}(?:%|percent|per ?cent|x|times|fold)\\s*(?:faster|slower|quicker|longer|shorter|as (?:fast|quickly|long))\\b`, 'g'),
  label: /\b(?:artemis|apollo|gemini|skylab|saffire|soyuz|expedition|sts|crew|mission|flight)[- ]?\d+\b|\b(?:19|20)\d\d\b/g,
  stray: /(?<![\p{L}\p{N}.,]|\p{L}-)\.?\p{Nd}+(?:[.,/]\p{Nd}+)*/gu,
  // A digit glued to letters is a name or an ID ("M7", "T1"), never a condition. Chemical names are fine.
  glued: /(?<![\p{L}\p{N}])\p{L}+-?\p{Nd}[\p{L}\p{Nd}]*/gu,
  formula: /^(?:o2|co2|n2|h2|h2o|jp-?8)$/,
  testId: /^m(?:[1-9]|1\d|20)$/,
  stillAir: /still air|no (?:air ?flow|ventilation|fans?|breeze)|fans? off|quiescent|stagnant|without (?:air ?flow|ventilation|fans?)/,
  thin: /\bthin(?:ner|nest)?\b/, thick: /\bthick(?:er|est)?\b/,
  safety: /\bsafe(?:st|r|ty)?\b|certif|approv|recommend|fire ?proof|guarantee|নিরাপদ/,
  // The thing asked about, when the question has the usual shape ("Will steel burn …?").
  // An embedded clause ("… that wood will burn") is more specific, so it is tried first.
  subject: [
    new RegExp(`\\b(?:if|whether|that)\\s+(.{1,40}?)\\s+(?:will|would|could|can|does|might|is|are)\\s+${VERB}\\b`),
    new RegExp(`${LEAD}(?:will|would|could|can|does|do|did|is|are|was|were|might|may|should)\\s+(.{1,40}?)\\s+${VERB}\\b`)
  ]
};

// Words that describe a sample or a place, not a material: "a 1 mm sheet on the ISS" names no material.
const FILLER = /^(?:a|an|the|my|our|your|this|that|these|those|some|any|of|and|or|at|in|on|with|under|for|near|inside|aboard|by|from|to|thin|thick|thinner|thicker|wide|narrow|small|large|big|little|flat|new|old|enough|also|still|ever|really|actually|even|just|very|too|much|how|when|where)$/;
const GENERIC = /^(?:it|this|that|they|them|something|anything|everything|stuff|things?|fires?|flames?|samples?|sheets?|strips?|pieces?|panels?|plates?|slabs?|materials?|objects?|items?|cabins?|habitats?|modules?|stations?|spacecraft|ships?|capsules?|rovers?|bases?|rooms?|labs?|you|we|i|there|iss|moon|mars|earth|orbit|space)$/;
const UNIT_WORD = /^(?:mm|cm|m|km|µm|um|in|inch|inches|ft|g|psi|psia|kpa|hpa|mbar|bar|pa|atm|mmhg|torr|mph|kph|kmh)$/;

// All matches of a global pattern, masked out of the text so later patterns can't read the same words again.
function take(state, re, fn) {
  const out = [];
  state.q = state.q.replace(re, (...m) => { const v = fn(m); if (v !== undefined) out.push(v); return ' '.repeat(m[0].length); });
  return out;
}
const mask = (state, m) => { state.q = state.q.slice(0, m.index) + ' '.repeat(m[0].length) + state.q.slice(m.index + m[0].length); };
const distinct = xs => [...new Map(xs.map(x => [x.value, x])).values()];

/** Reads a free-text question. Returns the conditions it found, plus notices, unresolved and unrecorded items. */
export function parseQuestion(text = '') {
  const q0 = String(text ?? '').toLowerCase().replace(/o₂/g, 'o2').replace(/\s+/g, ' ').trim();
  const fields = {}, notices = [], unresolved = [], unrecorded = [];
  const result = () => ({ fields, notices, unresolved, unrecorded, safety: PATTERNS.safety.test(q0), empty: !q0 });
  if (!q0) return result();
  const state = { q: q0 };
  const bad = (key, label, reason) => unresolved.push({ key, label, reason });

  // Airflow first, so "20 mm/s" can never be read as a 20 mm sheet.
  const flows = distinct(take(state, PATTERNS.velocity, m => {
    if (m[1] !== undefined) {
      const d = unitOf(m[2]), t = unitOf(m[3]);
      return LENGTH_CM[d] && TIME_S[t] ? { value: exact(+m[1] * LENGTH_CM[d] / TIME_S[t]), text: m[0].trim() } : undefined;
    }
    const k = m[5].replace(/\s+/g, '');
    return SPEED_CM_S[k] ? { value: exact(+m[4] * SPEED_CM_S[k]), text: m[0].trim() } : undefined;
  }));
  if (flows.some(f => f.value < 0)) bad('airflow', 'Airflow', 'An airflow can’t be negative.');
  else if (flows.length === 1) fields.airflow = flows[0].value;
  else if (flows.length > 1) { fields.airflow = 'all'; notices.push(`Comparing ${flows.map(f => f.text).join(' and ')}, so every tested airflow is shown.`); }
  else if (PATTERNS.stillAir.test(q0)) fields.airflow = 0;

  const pressures = distinct(take(state, PATTERNS.pressure, m => {
    const unit = unitOf(m[2]);
    return TO_PSI[unit] === undefined ? undefined : { value: round1(+m[1] * TO_PSI[unit]), text: m[0].trim() };
  }));
  if (pressures.some(p => p.value < 0)) bad('psi', 'Pressure', 'A pressure can’t be negative.');
  else if (pressures.length > 1) bad('psi', 'Pressure', `The question gives more than one pressure (${pressures.map(p => p.text).join(' and ')}). Ask about one at a time.`);
  else if (pressures.length === 1) fields.psi = pressures[0].value;

  const damp = take(state, PATTERNS.humidity, m => `${m[1] ?? m[2]}%`);
  if (damp.length) unrecorded.push({ key: 'humidity', label: 'Humidity', value: damp.join(' and ') });
  const named = PATTERNS.oxygen.flatMap(re => take(state, re, m => ({ value: +m[1], text: m[0] })));

  // An airflow or pressure number the app can't convert is set aside before the looser rules below run, so it
  // can't come back as a sheet thickness or an oxygen share.
  if (!flows.length && fields.airflow === undefined) {
    const m = PATTERNS.bareFlow.exec(state.q);
    if (m) { bad('airflow', 'Airflow', `“${m[0].trim()}” isn’t an airflow speed the app can read. Write it like 10 cm/s.`); mask(state, m); }
  }
  if (!pressures.length) {
    const m = PATTERNS.barePressure.exec(state.q);
    if (m) { bad('psi', 'Pressure', `“${m[0].trim()}” isn’t a pressure the app can read. Write it like 14.7 psi or 101 kPa.`); mask(state, m); }
  }

  // A bare percentage is read as oxygen only when nothing else is; beside a stated oxygen share it is a second one.
  const bare = take(state, PATTERNS.percent, m => ({ value: +m[1], text: m[0] }));
  const o2 = distinct([...named, ...bare]);
  if (!named.length && o2.length === 1) notices.push(`Read ${o2[0].value}% as the oxygen share.`);
  if (o2.some(x => x.value < 0 || x.value > 100)) bad('o2', 'Oxygen', 'An oxygen share has to be between 0% and 100%.');
  else if (o2.length > 1) bad('o2', 'Oxygen', `The question gives more than one oxygen share (${o2.map(x => `${x.value}%`).join(' and ')}). Ask about one at a time.`);
  else if (o2.length === 1) fields.o2 = o2[0].value;

  const temps = take(state, PATTERNS.temperature, m => m[1] !== undefined ? `${m[1]} °${m[2].toUpperCase()}` : `${m[3]} ${m[4]}`);
  if (temps.length) unrecorded.push({ key: 'temperature', label: 'Temperature', value: temps.join(' and ') });

  // Sample dimensions: "1 mm" is a thickness, "2.2 cm wide" a width, "30 cm long" a length no table records.
  const dims = take(state, PATTERNS.dimension, m => {
    const unit = unitOf(m[2]);
    if (!LENGTH_MM[unit]) return undefined;
    const kind = /wide|width|across/.test(m[3] || '') ? 'width' : /long|length|tall|high/.test(m[3] || '') ? 'length' : 'thickness';
    return { kind, value: exact(+m[1] * LENGTH_MM[unit]), text: m[0].trim() };
  });
  const sizes = distinct(dims.filter(d => d.kind === 'thickness'));
  if (sizes.some(s => s.value <= 0)) bad('thickness', 'Thickness', 'A thickness has to be more than zero.');
  else if (sizes.length === 1) fields.thickness = sizes[0].value;
  else if (sizes.length > 1) { fields.thickness = 'all'; notices.push(`Comparing ${sizes.map(s => `${s.value} mm`).join(' and ')} sheets, so every thickness is shown.`); }
  const widths = distinct(dims.filter(d => d.kind === 'width'));
  if (widths.some(w => w.value <= 0)) bad('width', 'Width', 'A width has to be more than zero.');
  else if (widths.length === 1) fields.width = widths[0].value;
  else if (widths.length > 1) { fields.width = 'all'; notices.push(`Comparing ${widths.map(w => `${w.value / 10} cm`).join(' and ')} wide samples, so every width is shown.`); }
  const length = dims.find(d => d.kind === 'length');
  if (length) unrecorded.push({ key: 'length', label: 'Sample length', value: length.text });

  // Where: a mission tile, Earth, or another world. A named place never falls back to the ISS.
  const hits = Object.entries(PATTERNS.mission).map(([id, re]) => ({ id, i: q0.search(re), m: q0.match(re) })).filter(x => x.i >= 0);
  const g = PATTERNS.gravity.exec(state.q);
  if (g) {
    const v = g[1] !== undefined ? g[1] / g[2] : g[3] !== undefined ? +g[3] : g[4] !== undefined ? g[4] / g[5] : +g[6];
    const r = Math.round(v * 1000) / 1000;
    mask(state, g);
    if (!Number.isFinite(r) || r < 0) bad('gravity', 'Gravity', `“${g[0].trim()}” isn’t a gravity the app can read.`);
    else {
      const id = r === 0 ? 'iss' : r === 1 ? 'earth' : r === 0.38 ? 'mars' : [0.16, 0.166, 0.167, 0.17].includes(r) ? 'moon' : 'other';
      hits.push({ id, i: g.index, g: id === 'other' ? r : undefined });
    }
  }
  take(state, /(?<![\d.])1 ?g\b/g, () => undefined);   // "1 g" was read as Earth above
  if (!hits.length) { const i = q0.search(PATTERNS.room); if (i >= 0) hits.push({ id: 'earth', i }); }
  const places = (hits.some(x => x.id === 'transit') ? hits.filter(x => x.id !== 'mars') : hits).sort((a, b) => a.i - b.i);
  if (places.length) {
    const first = places[0];
    fields.mission = first.id;
    if (first.id === 'other' && first.g !== undefined) fields.g = first.g;
    else if (first.id === 'other') fields.place = (first.m[1] ?? first.m[2]).replace(/^(?:an|a|the) /, '').replace(/^\w/, c => c.toUpperCase());
    if (new Set(places.map(x => x.id)).size > 1) notices.push('You mentioned more than one place, so this shows the first one. Tap a mission to switch.');
  }

  if (PATTERNS.exploration.test(q0)) fields.air = 'exploration';
  else if (PATTERNS.earthAir.test(q0)) fields.air = 'earth';

  // Last, any number no rule has read. A comparison between results ("3 times faster") isn't a condition, so it is
  // set aside with a notice, and a year or a mission's number is only a name. Anything else stops the answer.
  const aside = take(state, PATTERNS.comparison, m => m[0].trim());
  if (aside.length) notices.push(`${aside.map(a => `“${a}”`).join(' and ')} ${aside.length > 1 ? 'compare results, so they aren’t' : 'compares results, so it isn’t'} read as a cabin condition.`);
  take(state, PATTERNS.label, () => undefined);
  const stray = [...state.q.matchAll(PATTERNS.stray)]
    .map(m => q0.slice(m.index).match(/^\S+(?:\s+[^\s\d]\S{0,4}(?=[\s?!.,;:]|$))?/)[0].replace(/[?!.,;:]+$/, ''));
  if (stray.length) bad('number', 'Number', `The app couldn’t read ${stray.map(s => `“${s}”`).join(' or ')}. Write it with a unit, like 1 mm, 10 cm/s, 21% oxygen or 14.7 psi.`);
  const ids = [...state.q.matchAll(PATTERNS.glued)].map(m => m[0]).filter(w => !PATTERNS.formula.test(w));
  const tests = ids.filter(w => PATTERNS.testId.test(w)).map(w => w.toUpperCase()), names = ids.filter(w => !PATTERNS.testId.test(w));
  if (tests.length) bad('number', 'Test', `${tests.map(t => `“${t}”`).join(' and ')} ${tests.length > 1 ? 'look like BASS-II test IDs' : 'looks like a BASS-II test ID'}. This page answers questions about a cabin, not about one test. Look ${tests.length > 1 ? 'them' : 'it'} up in the research view.`);
  if (names.length) bad('number', 'Number', `The app couldn’t read ${names.map(n => `“${n}”`).join(' or ')}. Write the conditions with units, like 1 mm, 10 cm/s, 21% oxygen or 14.7 psi.`);

  // "Thin" and "thick" stand for the thinnest and thickest tested sheets, unless the question gave a size of its own.
  if (!sizes.length && !stray.length && !ids.length) {
    const thin = PATTERNS.thin.test(q0), thick = PATTERNS.thick.test(q0);
    if (thin && thick) { fields.thickness = 'all'; notices.push('Comparing thin and thick sheets, so every thickness is shown.'); }
    else if (thin) { fields.thickness = ENVELOPE.thicknesses[0]; notices.push(`Read “thin” as the thinnest tested sheet, ${fields.thickness} mm.`); }
    else if (thick) { fields.thickness = ENVELOPE.thicknesses.at(-1); notices.push(`Read “thick” as the thickest tested sheet, ${fields.thickness} mm.`); }
  }

  // What: the subject of the question when it names something the catalog doesn't list ("steel"), otherwise the
  // first tested material mentioned, otherwise the first untested one. The subject is read from the masked text,
  // so numbers and units already read aren't mistaken for a material.
  const found = MATERIALS.filter(m => m.re.test(q0));
  const subject = PATTERNS.subject.map(re => re.exec(state.q)).find(Boolean)?.[1] ?? '';
  const leftover = subject.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(w => w && !FILLER.test(w) && !GENERIC.test(w)
    && !/\p{N}/u.test(w) && !UNIT_WORD.test(w) && !found.some(m => m.re.test(w)));
  const subjectNamesFound = found.some(m => m.re.test(subject));
  if (leftover.length && !subjectNamesFound) {
    fields.material = 'other';
    fields.materialName = leftover.slice(0, 3).join(' ');
    if (found.length) notices.push(`This shows ${fields.materialName}, as asked, so ${found.map(m => m.inline).join(' and ')} ${found.length > 1 ? 'aren’t' : 'isn’t'} shown.`);
  } else if (found.length) {
    const chosen = found.find(m => m.supported) ?? found[0];
    const others = found.filter(m => m !== chosen && !(chosen.covers || []).includes(m.id)).map(m => m.inline);
    if (leftover.length) others.push(leftover.join(' '));
    fields.material = chosen.id;
    if (others.length) notices.push(`This shows ${chosen.inline}, so ${others.join(' and ')} ${others.length > 1 ? 'aren’t' : 'isn’t'} shown.`);
  }

  if (PATTERNS.safety.test(q0)) notices.push('This shows what NASA observed. It can’t certify a material as safe.');
  if (!Object.keys(fields).length && !unresolved.length && !unrecorded.length)
    notices.push('No place, material or cabin condition found in that question, so the defaults are shown. Try a suggestion below.');
  return result();
}
