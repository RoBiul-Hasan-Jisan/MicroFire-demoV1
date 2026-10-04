import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestion, ask, InputError } from '../src/compute/scenario.mjs';

const f = q => parseQuestion(q).fields;

test('supported units are normalised: airflow to cm/s, pressure to psi, thickness to mm', () => {
  for (const [q, cmS] of [['at 12 cm/s', 12], ['at 20 mm/s', 2], ['with airflow 1 m/s', 100], ['0.05 m per second', 5], ['1 ft/s', 30.48],
    ['3.6 km/h of wind', 100], ['1 mph', 44.704], ['6 m/min', 10]]) assert.equal(f(q).airflow, cmS, q);
  for (const [q, psi] of [['at 56.5 kPa', 8.2], ['at 1 atm', 14.7], ['at 1 bar', 14.5], ['at 760 mmHg', 14.7], ['at 100 psi', 100], ['at 0.5 atmospheres', 7.3]])
    assert.equal(f(q).psi, psi, q);
  for (const [q, mm] of [['a 1 mm sheet', 1], ['a 0.5 cm thick panel', 5], ['a 500 µm film', 0.5], ['a 0.1 inch sheet', 2.54]]) assert.equal(f(q).thickness, mm, q);
  assert.equal(f('a 2.2 cm wide strip').width, 22);
});

test('a velocity unit is never read as a sheet thickness', () => {
  assert.deepEqual(f('Will acrylic burn on the ISS with 20 mm/s airflow?'), { airflow: 2, mission: 'iss', material: 'pmma' });
  const both = f('a 3 mm sheet with 5 mm/s of airflow');
  assert.equal(both.thickness, 3); assert.equal(both.airflow, 0.5);
  assert.equal(f('at 10 millimetres per second').thickness, undefined);
});

test('explicit values outside the tests are kept, never replaced by a supported default', () => {
  assert.equal(f('at 0% oxygen').o2, 0);
  assert.equal(f('at 100 psi').psi, 100);
  assert.equal(f('a 50 mm slab').thickness, 50);
  for (const [q, state, headline] of [
    ['Will acrylic burn on the ISS at 0% oxygen?', 'no-data', /never went below 16\.8% oxygen/],
    ['Will acrylic burn on the ISS at 100 psi?', 'no-data', /No test here is documented at 100 psi/],
    ['Will acrylic burn on the ISS with airflow 1 m/s?', 'no-data', /never ran above 21 cm\/s/],
    ['Will a 50 mm acrylic slab burn on the ISS?', 'no-data', /only used 1, 2, 3, 4 and 5 mm sheets/]
  ]) {
    const r = ask({ q });
    assert.equal(r.verdict.state, state, q); assert.match(r.verdict.headline, headline, q);
    assert.ok(r.understood.some(u => u.from === 'question'), q);
  }
});

test('materials the catalog doesn’t list stay what was asked, and never become acrylic', () => {
  for (const [q, name] of [['Will steel burn on the ISS?', 'Steel'], ['Can aluminium catch fire in orbit?', 'Aluminium'],
    ['Will my laptop burn?', 'Laptop'], ['Hey, will polycarbonate burn?', 'Polycarbonate'], ['Is it true that wood will burn?', 'Wood']]) {
    const r = ask({ q });
    assert.equal(r.scenario.material.id, 'other', q); assert.equal(r.scenario.material.name, name, q);
    assert.equal(r.verdict.state, 'no-data', q); assert.match(r.verdict.headline, /There’s no .* data in this set/, q);
  }
  // Words that name a sample, a pronoun or a place are not materials, so the default applies (and is shown as one).
  for (const q of ['Will it burn on a Moon base at 34% oxygen?', 'Does a 1 mm sheet burn faster than 5 mm?', 'Will the ISS burn?', 'Will the sample burn in still air?'])
    assert.equal(ask({ q }).understood.find(u => u.field === 'Material').from, 'default', q);
  assert.match(parseQuestion('Will steel burn next to acrylic?').notices[0], /This shows steel, as asked, so acrylic isn’t shown/);
});

test('places no test reached are explicit and unsupported, never the ISS', () => {
  for (const [q, id] of [['Will acrylic burn on Earth?', 'earth'], ['Will acrylic burn on the ground?', 'earth'], ['acrylic at 1 g', 'earth'],
    ['Will acrylic burn in a lab?', 'earth'], ['Will acrylic burn on Venus?', 'other'], ['acrylic at 0.5 g', 'other'], ['acrylic on Titan', 'other']]) {
    const r = ask({ q });
    assert.equal(r.scenario.mission.id, id, q); assert.equal(r.scenario.mission.supported, false, q);
    assert.equal(r.verdict.state, 'no-data', q); assert.ok(r.checks.find(c => c.key === 'gravity').ok === false, q);
    assert.ok(r.missions.every(m => !m.selected), q);
  }
  assert.equal(ask({ q: 'acrylic on Venus' }).scenario.mission.name, 'Venus');
  assert.equal(ask({ q: 'acrylic at 0.38 g' }).scenario.mission.id, 'mars');
  assert.equal(ask({ q: 'acrylic at 0.1 g' }).notices.length, 0, '0.1 g is not also read as 1 g');
});

test('malformed or contradictory conditions are unresolved: no answer is given for a guessed value', () => {
  for (const [q, key] of [['acrylic at 150% oxygen', 'o2'], ['acrylic at 21% and 34% oxygen', 'o2'], ['acrylic with airflow of 5', 'airflow'],
    ['acrylic at a pressure of 10', 'psi'], ['acrylic at 10 psi and 50 kPa', 'psi'], ['acrylic at -5 cm/s', 'airflow']]) {
    const r = ask({ q });
    assert.equal(r.verdict.state, 'unresolved', q); assert.equal(r.unresolved[0].key, key, q);
    assert.equal(r.evidence, null, q); assert.equal(r.nearest, null, q);
    assert.equal(r.canonical, q, 'the question is not rewritten into one the app made up');
    assert.ok(r.understood.some(u => u.from === 'unresolved'), q);
  }
  // A tap replaces the unreadable part, and the answer comes back.
  assert.equal(ask({ q: 'acrylic at 150% oxygen', air: 'earth' }).verdict.state, 'burned');
});

test('conditions no table records are named, and block an affirmative answer', () => {
  for (const [q, key] of [['Will acrylic burn at 25 °C?', 'temperature'], ['a 30 cm long acrylic strip', 'length'], ['acrylic at 50% humidity', 'humidity']]) {
    const r = ask({ q });
    assert.equal(r.verdict.state, 'no-data', q); assert.ok(r.checks.some(c => c.key === key && c.status === 'unrecorded' && !c.ok), q);
  }
  assert.equal(f('acrylic at 50% humidity').o2, undefined, 'a humidity percentage is not an oxygen share');
  assert.deepEqual(parseQuestion('Will acrylic burn at 25 °C and 30 °C?').unrecorded, [{ key: 'temperature', label: 'Temperature', value: '25 °C and 30 °C' }]);
  const rh = parseQuestion('Will acrylic burn at 50% RH?');
  assert.equal(rh.fields.o2, undefined); assert.deepEqual(rh.unrecorded.map(u => u.key), ['humidity']);
});

test('a number no rule reads is unresolved, never dropped', () => {
  for (const [q, shown] of [['Will a 0.5 in acrylic sheet burn on the ISS?', '0.5 in'], ['Will a 3 acrylic sheet burn?', '3'],
    ['Will a 1 mm acrylic sheet burn at 7?', '7'], ['Will acrylic burn at 1-5 mm?', '1-5 mm'], ['Will a 0,5 mm sheet burn?', '0,5 mm'],
    ['Will acrylic burn with 5% CO2?', '5% co2'], ['Will acrylic burn with 5% more oxygen?', '5% more'], ['Will acrylic burn at ৩৪% oxygen?', '৩৪%']]) {
    const r = ask({ q });
    assert.equal(r.verdict.state, 'unresolved', q); assert.equal(r.evidence, null, q);
    const u = r.unresolved.find(x => x.key === 'number');
    assert.ok(u && u.reason.includes(`“${shown}”`), `${q}: ${u?.reason}`);
    assert.match(r.verdict.sub, /Reword the question to get an answer/, 'no tap can replace a number the app couldn’t place');
  }
  // A digit glued to letters is a name or an ID, not a condition, so it isn't dropped either (review case: "M7").
  const test7 = ask({ q: 'Will M7 burn at 21% oxygen?' });
  assert.equal(test7.verdict.state, 'unresolved'); assert.match(test7.unresolved[0].reason, /“M7” looks like a BASS-II test ID/);
  assert.equal(ask({ q: 'Will acrylic burn at GMT45?' }).verdict.state, 'unresolved');
  for (const q of ['Will acrylic burn at 21% O2?', 'Is CO2 a problem when acrylic burns?', 'Will jp-8 burn?', 'Will acrylic burn in N2 and O2?'])
    assert.equal(parseQuestion(q).unresolved.length, 0, `${q}: chemical names aren’t numbers`);
  // "Thick" beside a size it couldn't read isn't a guess at the thickest sheet.
  const thick = parseQuestion('Will a 0.5 in thick acrylic sheet burn?');
  assert.equal(thick.fields.thickness, undefined); assert.ok(!thick.notices.some(n => /thick/.test(n)));
});

test('an airflow or pressure the app can’t convert never comes back as a thickness or an oxygen share', () => {
  // The review case: the words after "flow" stayed unmasked, and "0.3 cm" came back as a 3 mm sheet.
  const flow = parseQuestion('Will it burn with a flow of 0.3 cm against it?');
  assert.equal(flow.fields.thickness, undefined);
  assert.deepEqual(flow.unresolved.map(u => u.key), ['airflow']);
  assert.match(flow.unresolved[0].reason, /“flow of 0\.3 cm”/, 'the whole number is quoted, not "flow of 0"');
  const fans = parseQuestion('Will acrylic burn with ventilation at 50%?');
  assert.equal(fans.fields.o2, undefined, 'a fan setting is not an oxygen share');
  assert.deepEqual(fans.unresolved.map(u => u.key), ['airflow']);
  assert.deepEqual(parseQuestion('acrylic at a pressure of 8').unresolved.map(u => u.key), ['psi']);
});

test('hyphenated units and leading decimals read like spaced ones', () => {
  for (const [q, key, v] of [['a 0.5-inch sheet', 'thickness', 12.7], ['a 5-mm sheet', 'thickness', 5], ['a .5 mm film', 'thickness', 0.5],
    ['at 8.2-psi', 'psi', 8.2], ['a 10-cm/s breeze', 'airflow', 10]]) {
    const p = parseQuestion(q);
    assert.equal(p.fields[key], v, q); assert.equal(p.unresolved.length, 0, q);
  }
  assert.equal(f('Will a 0.5-inch acrylic sheet burn?').material, 'pmma', 'a unit is never read as a material');
});

test('numbers that aren’t cabin conditions are named or set aside, not read as one', () => {
  const faster = ask({ q: 'Does a 1 mm sheet burn 3 times faster than 5 mm?' });
  assert.notEqual(faster.verdict.state, 'unresolved');
  assert.ok(faster.notices.some(n => n.includes('“3 times faster”')), 'the comparison is set aside with a notice');
  for (const q of ['Will acrylic burn on the Moon base planned for 2030?', 'Will acrylic burn on Artemis 3?'])
    assert.equal(parseQuestion(q).unresolved.length, 0, q);
  assert.equal(f('Is 30% O2 enough for acrylic to burn?').o2, 30, 'the 2 in O2 is part of a name');
  assert.deepEqual(parseQuestion('Is 30% O2 enough for acrylic to burn?').notices, [], 'filler words aren’t a second material');
  assert.equal(f('Will jp-8 burn?').material, 'fuel');
});

test('gravity in words or fractions is read, and a vague one stays what was asked', () => {
  assert.equal(f('acrylic at 1/6 g').mission, 'moon');
  assert.equal(f('acrylic at one-sixth of Earth’s gravity').mission, 'moon');
  assert.deepEqual(parseQuestion('acrylic at one-sixth of Earth’s gravity').notices, [], 'not also read as Earth');
  assert.equal(f('acrylic in zero gravity').mission, 'iss');
  const partial = ask({ q: 'Will acrylic burn in partial gravity?' });
  assert.equal(partial.scenario.mission.id, 'other'); assert.equal(partial.scenario.mission.name, 'Partial gravity');
  assert.equal(partial.verdict.state, 'no-data');
  // The hint offers only taps that exist: thickness chips are for acrylic sheets.
  assert.match(ask({ q: 'Will a -1 mm acrylic sheet burn?' }).verdict.sub, /tap a thickness/);
  assert.match(ask({ q: 'Will a -1 mm Nomex sample burn?' }).verdict.sub, /Reword the question to get an answer/);
  const unreadable = ask({ q: 'Will acrylic burn at 1/0 g?' });
  assert.equal(unreadable.verdict.state, 'unresolved'); assert.match(unreadable.verdict.sub, /tap a mission/);
  assert.equal(ask({ q: 'Will acrylic burn at 1/0 g?', mission: 'iss' }).verdict.state, 'burned', 'a mission tap replaces it');
});

test('a room on Earth is a weak sign of place: a spacecraft named in the same question wins', () => {
  assert.equal(f('Will it burn in the lab module aboard the station?').mission, 'iss');
  assert.equal(f('Will it burn in the ISS lab?').mission, 'iss');
  assert.equal(f('Will acrylic burn in my kitchen?').mission, 'earth');
});

test('a safety question never gets a yes or no', () => {
  for (const q of ['Is acrylic safe on the ISS?', 'Is SIBAL fabric safe on the ISS?', 'Is Nomex safe on the ISS?', 'Is acrylic safe at 10 cm/s?']) {
    const r = ask({ q });
    assert.doesNotMatch(r.verdict.headline, /^(?:Yes|No|Sometimes|Not in)\b/, q);
    assert.ok(r.notices.some(n => /can’t certify/.test(n)), q);
  }
  assert.match(ask({ q: 'Will acrylic burn on the ISS?' }).verdict.headline, /^Yes\. /, 'a burn question still gets its plain answer');
});

test('tapped values are validated with their types, and 0% oxygen is a valid explicit value', () => {
  assert.equal(ask({ o2: 0 }).verdict.state, 'no-data');
  for (const bad of [{ o2: 101 }, { psi: -1 }, { airflow: true }, { thickness: 'thick' }, { material: 'other' }, { mission: 'pluto' }])
    assert.throws(() => ask(bad), InputError, JSON.stringify(bad));
  assert.equal(ask({ mission: 'earth' }).scenario.mission.name, 'Earth');
  assert.equal(ask({ material: 'other', materialName: 'steel <b>' }).scenario.material.name, 'Steel b', 'names are reduced to plain words');
});
