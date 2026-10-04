// Will It Burn? — browser side. It never decides anything scientific itself:
// it sends the question or tapped controls to GET /api/ask and renders the JSON.
// Request ordering and tap handling live in state.js, which the Node tests run directly.
import { createController, verdictView, askedFor } from './state.js';

const QUESTIONS = [
  'Will acrylic burn on the ISS?',
  'Will it burn on a Moon base at 34% oxygen?',
  'What about Mars transit in exploration air?',
  'Does a 1 mm sheet burn faster than 5 mm?',
  'Will a 1 mm acrylic sheet burn in still air?',
  'Is Nomex safe on a Mars base?'
];
const KEYWORDS = ['ISS', 'Moon base', 'Mars transit', 'Mars base', '34% oxygen', '8.2 psi', '1 mm', '5 mm', 'still air', '10 cm/s', 'acrylic', 'Nomex'];
const THICKNESSES = [1, 2, 3, 4, 5];
const TABS = ['overview', 'findings', 'response', 'sources'];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const input = $('#q');
let records = [], result = null, asked = '', firstAnswer = true;

async function api(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Request failed.');
  return data;
}
function showError(message) { const e = $('#ask-error'); e.textContent = message; e.hidden = !message; }
const unreachable = error => error instanceof TypeError ? 'Couldn’t reach the local server. Start it with: node src/api/server.mjs' : error.message;

// ---------- Sections: a sidebar on wide screens, a tab bar on phones, both driven by the URL hash ----------
function showTab(focus) {
  const name = TABS.find(t => location.hash === '#' + t) ?? 'overview';
  for (const t of TABS) $('#panel-' + t).hidden = t !== name;
  for (const a of $$('.nav, .tab')) {
    if (a.hash === '#' + name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (focus) { scrollTo(0, 0); $('#h-' + name).focus({ preventScroll: true }); }
}
addEventListener('hashchange', () => showTab(true));
showTab(false);

// ---------- Talking to the server ----------
const controller = createController({
  request: params => api('/api/ask?' + new URLSearchParams(Object.entries(params).filter(([, x]) => x !== undefined && x !== null && x !== ''))),
  onBusy: busy => { if (busy) $('#result').setAttribute('aria-busy', 'true'); else $('#result').removeAttribute('aria-busy'); },
  onAnswer: (data, meta) => {
    result = data;
    asked = askedFor(data, meta);
    if (meta.kind === 'tap') input.value = data.canonical;
    showError('');
    render(!firstAnswer);
    firstAnswer = false;
  },
  onError: (error, meta) => showUnanswered(unreachable(error), meta.kind === 'question' ? meta.question : input.value)
});
const change = patch => controller.change(patch);

// ---------- Asking: the field, suggested questions and words to add ----------
$('#questions').innerHTML = QUESTIONS.map(q => `<button type="button" class="sug" data-q="${esc(q)}">${esc(q)}</button>`).join('');
$('#keywords').innerHTML = KEYWORDS.map(k => `<button type="button" class="kw" data-k="${esc(k)}">${esc(k)}</button>`).join('');
$('#questions').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return;
  input.value = b.dataset.q; controller.ask(b.dataset.q);
});
// The word list shows while the field has focus. Pressing a word keeps the caret in the field.
$('.ask-pop').addEventListener('pointerdown', e => e.preventDefault());
$('#keywords').addEventListener('click', e => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  const current = input.value.trim().replace(/\?$/, '');
  input.value = (current ? current + ' ' : '') + b.dataset.k;
  input.focus();
});
input.addEventListener('keydown', e => { if (e.key === 'Escape') input.blur(); });
$('#ask-form').addEventListener('submit', e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) { showError('Type a question, or tap one of the suggestions below.'); return; }
  document.activeElement?.blur();
  if (location.hash && location.hash !== '#overview') location.hash = '#overview';
  controller.ask(q);
});

function renderRead() {
  $('#read').innerHTML = result.understood.map(u => `<span class="rchip ${esc(u.from)}"><b>${esc(u.field)}</b>${esc(u.value)}</span>`).join('');
  $('#notices').innerHTML = result.notices.map(n => `<p class="notice">${esc(n)}</p>`).join('');
}
function renderTiles() {
  $('#tiles').innerHTML = result.missions.map(m => `<button type="button" class="tile" data-m="${esc(m.id)}" aria-pressed="${m.selected}">
      <span class="tile-top"><span class="tile-name">${esc(m.name)}</span><span class="tile-g">${esc(m.gText)}</span></span>
      <span class="tile-sub">${esc(m.sub)}</span>
      <span class="tile-home">${esc(m.home)}</span>
      <span class="badge ${m.matches ? 'ok' : 'miss'}">${m.matches ? m.matches + ' tests match' : 'No tests match'}</span>
    </button>`).join('');
}
$('#tiles').addEventListener('click', e => {
  const b = e.target.closest('.tile'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
  change({ mission: b.dataset.m });
  const top = $('#result').getBoundingClientRect().top;
  if (top > innerHeight * 0.6) $('#result').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
});

// ---------- Verdict, chamber and cabin ----------
// Neutral states: nothing is shown as an answer until an answer arrives for the question on screen.
function showVerdictState(cls, word, count, headline, sub, question) {
  const stamp = $('#stamp');
  stamp.className = 'stamp ' + cls;
  stamp.innerHTML = `<span class="stamp-word">${esc(word)}</span>${count ? `<span class="stamp-count">${esc(count)}</span>` : ''}`;
  $('#headline').textContent = headline;
  $('#sub').textContent = sub;
  $('#why').hidden = true;
  const answering = $('#answering');
  answering.hidden = !question;
  answering.textContent = question ? `Asked: “${question}”` : '';
}
function showUnanswered(message, question) {
  result = null;
  showError('');
  showVerdictState('unavailable', 'Not answered', '', 'This question wasn’t answered.', message, question);
  $('#read').innerHTML = ''; $('#notices').innerHTML = '';
  $('#kpis').hidden = true;
  $('#match').innerHTML = ''; $('#match-note').textContent = '';
  $('#s2').textContent = 'Evidence'; $('#s2-aside').textContent = '';
  $('#panel2').innerHTML = '<p class="note">No answer to show. Try again, or ask another question.</p>';
  $('#proof-text').textContent = 'Source rows appear here once a question is answered.';
  $('#open-proof').hidden = true;
  for (const b of $$('#seg [data-air], #materials [data-material]')) b.setAttribute('aria-pressed', 'false');
  for (const t of $$('#tiles .tile')) t.setAttribute('aria-pressed', 'false');
  flame.set(0, false, true);
  $('#ov-msg').hidden = false;
  $('#caption').textContent = 'No answer, so the flame is only a dashed outline.';
}

function renderVerdict(animate) {
  const { verdict, scenario: s, checks } = result, view = verdictView(result);
  showVerdictState(view.stampClass, verdict.stamp, verdict.count, verdict.headline, verdict.sub, asked);
  if (animate && !reduced) { const stamp = $('#stamp'); void stamp.offsetWidth; stamp.classList.add('in'); }
  const why = $('#why');
  why.hidden = !result.why;
  if (result.why) why.innerHTML = `<b>${esc(result.why.lead)}</b> ${esc(result.why.text)} <a href="${esc(result.why.source.url)}" target="_blank" rel="noopener">Source</a>`;

  for (const key of ['earth', 'exploration']) $('#air-' + key).setAttribute('aria-pressed', String(!s.air.explicitO2 && !s.air.explicitPsi && s.air.preset === key));
  $('#air-note').textContent = s.air.key === 'custom' ? `Custom air from your question: ${s.air.o2}% O₂ at ${s.air.psi} psi.` : s.mission.note;
  for (const b of $$('#materials [data-material]')) b.setAttribute('aria-pressed', String(b.dataset.material === s.material.id));

  const pill = c => c.ok ? ({ match: 'ok', context: 'ctx', unrecorded: 'nr' }[c.status] ?? 'ok') : 'miss';
  $('#match').innerHTML = checks.map(c => `<div class="match-row"><span class="k">${esc(c.label)}</span><span class="pill ${pill(c)}">${c.ok && c.status === 'match' ? '✓ ' : !c.ok ? '✕ ' : ''}${esc(c.statusLabel)}</span>
    <span class="vals"><span>Your cabin: <b>${esc(c.yours)}</b></span><span>NASA’s tests: <b>${esc(c.tested)}</b></span></span>
    ${c.note ? `<span class="mnote">${esc(c.note)}</span>` : ''}</div>`).join('');
  $('#match-note').textContent = '';

  $('#ov-cam').textContent = s.mission.name;
  $('#ov-g').textContent = s.mission.gText;
  $('#ov-gname').textContent = s.mission.gName;
  $('#ov-air').textContent = `${s.air.o2}% O₂ at ${s.air.psi} psi`;
  $('#ov-po2').textContent = `O₂ pressure ${s.air.po2} kPa`;
  $('#ov-msg').hidden = !view.shapeNote;
  $('#caption').textContent = view.caption;
  flame.set(view.flame.g, view.flame.known, view.flame.lit);
}
$('#seg').addEventListener('click', e => {
  const b = e.target.closest('button[data-air]'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
  change({ air: b.dataset.air });
});
$('#materials').addEventListener('click', e => {
  const b = e.target.closest('button[data-material]'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
  change({ material: b.dataset.material, thickness: 'all' });
});

// ---------- Key numbers: the matching tests at a glance. Each one opens its rows. ----------
function renderKpis() {
  const ev = result.evidence, box = $('#kpis');
  box.hidden = !ev;
  if (!ev) return;
  const kpi = (label, value, unit, sub, ids, go = 'Source rows') => `<button type="button" class="kpi" data-ids="${esc(ids.join(','))}">
      <span class="kpi-l">${esc(label)}</span><span class="kpi-v">${esc(value)}${unit ? `<small>${esc(unit)}</small>` : ''}</span>
      <span class="kpi-s">${esc(sub)}</span><span class="kpi-go">${esc(go)}</span></button>`;
  if (ev.kind === 'outcomes') {
    const c = ev.counts, at = ev.airflow === null ? '' : ` to ${ev.airflow} cm/s`;
    // The same words the server uses for each test, and the parts add up to every matching test.
    const parts = [['burned', c.burned, ev.airflow === null ? 'burned' : `burning at ${ev.airflow} cm/s`],
      ['quenched', c.quenched, `burned, then went out as the airflow was turned down${at}`],
      ['blowoff', c.blowoff, `burned, then blew out as the airflow was turned up${at}`],
      ['none', c.noIgnition, ev.set === 'nomex' ? 'held no flame' : 'didn’t ignite']].filter(p => p[1] > 0);
    box.innerHTML = kpi('Tests', c.tests, '', ev.label, ev.ids)
      + `<button type="button" class="kpi wide" data-ids="${esc(ev.ids.join(','))}"><span class="kpi-l">What happened</span>
        <span class="ob" aria-hidden="true">${parts.map(p => `<span class="${p[0]}" data-n="${esc(p[1])}"></span>`).join('')}</span>
        <span class="ob-legend">${parts.map(p => `<span><i class="${p[0]}"></i><b>${esc(p[1])}</b> ${esc(p[2])}</span>`).join('')}</span>
        <span class="kpi-go">Source rows</span></button>`;
    for (const seg of box.querySelectorAll('.ob [data-n]')) seg.style.flexGrow = seg.dataset.n;
    return;
  }
  const st = ev.stats, spreadKpi = (label, p) => p
    ? kpi(label, p.spread, 'mm/s', `${p.id}, ${p.thicknessMm} mm sheet, ${p.velocity} cm/s air`, [p.id], 'Source row')
    : kpi(label, 'Not tracked', '', 'No spread was tracked at these conditions', ev.ids);
  box.innerHTML = kpi('Tests', st.tests, '', st.notTracked ? `${st.notTracked} with spread not tracked` : 'All with spread tracked', ev.ids)
    + kpi('Burned for', `${Math.round(st.burnMin)}–${Math.round(st.burnMax)}`, 'min', 'per test', ev.ids)
    + spreadKpi('Fastest spread', st.fastest) + spreadKpi('Slowest spread', st.slowest);
}
$('#kpis').addEventListener('click', e => {
  const b = e.target.closest('.kpi'); if (!b || !result?.evidence) return;
  openProof(result.evidence.kind === 'outcomes' ? result.evidence : b.dataset.ids.split(','));
});

// ---------- Evidence: the chart, the report's own rows, the gaps, or what couldn't be read ----------
function renderPanel2() {
  const panel = $('#panel2');
  if (result.verdict.state === 'unresolved') {
    $('#s2').textContent = 'What couldn’t be read';
    $('#s2-aside').textContent = 'Nothing is answered until it is clear';
    // An unreadable acrylic thickness can be replaced with a tap, so its chips stay on screen, none of them chosen.
    const pickSize = result.scenario.material.id === 'pmma' && result.unresolved.some(u => u.key === 'thickness');
    panel.innerHTML = `<div class="gaps">${result.unresolved.map(u => `<div class="gap-card unclear"><span class="t">${esc(u.label)}</span><p>${esc(u.reason)}</p></div>`).join('')}</div>
      ${pickSize ? `<div class="mat-row"><div class="mat"><b>Pick a tested thickness</b><span>It replaces the one that couldn’t be read</span></div>${thicknessChips(undefined)}</div>` : ''}`;
    if (pickSize) wireThicknessChips(panel);
    return;
  }
  if (!result.evidence) {
    $('#s2').textContent = 'What would close this gap?';
    $('#s2-aside').textContent = 'Each card links to its source';
    panel.innerHTML = `<div class="gaps">${result.gaps.map(g => `<div class="gap-card"><span class="t">${esc(g.topic)}</span><p>${esc(g.text)}</p><a href="${esc(g.source.url)}" target="_blank" rel="noopener">${esc(g.source.name)}</a></div>`).join('')}</div>
      ${closestHtml(result.closest)}
      ${result.nearest ? `<div class="row-actions"><button class="btn alt" type="button" id="nearest">${esc(result.nearest.label)}</button><span class="note">${esc(result.nearest.changes)}</span></div>` : ''}`;
    $('#nearest')?.addEventListener('click', () => change(result.nearest.params));
    return;
  }
  if (result.evidence.kind === 'outcomes') return renderOutcomes(result.evidence);
  const ev = result.evidence, t = ev.thickness;
  $('#s2').textContent = 'What’s burning?';
  $('#s2-aside').textContent = 'Tap a thickness, or a dot for its row';
  panel.innerHTML = `
    <div class="mat-row">
      <div class="mat"><b>${esc(result.scenario.material.name)}</b><span>NASA’s standard test fuel</span></div>
      ${thicknessChips(t)}
    </div>
    <div class="chart-wrap" id="chart"></div><div class="legend" id="legend"></div>
    <p class="finding"><b>${esc(ev.finding.lead)}</b> ${esc(ev.finding.text)}</p>
    <p class="caveat">${esc(ev.caveat)}</p>
    ${relatedHtml(result.related)}`;
  wireThicknessChips(panel);
  renderChart(ev);
}

// The thickness chips. `selected` is null for all sheets, a thickness, or undefined when none is chosen yet.
function thicknessChips(selected) {
  return `<div class="chips" role="group" aria-label="Sheet thickness">
        <button type="button" data-t="all" aria-pressed="${selected === null}">All</button>
        ${THICKNESSES.map(n => `<button type="button" data-t="${n}" aria-pressed="${selected === n}"><i class="sw sw${n}"></i>${n} mm</button>`).join('')}
      </div>`;
}
function wireThicknessChips(panel) {
  panel.querySelector('.chips').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
    change({ thickness: b.dataset.t });
  });
}

// Tests that recorded some of the conditions but not all: shown with their own rows, never counted as a match.
function closestHtml(c) {
  if (!c) return '';
  return `<div class="closest"><h3>Closest tests, and what each one recorded</h3>
    <div class="tbl"><table><thead><tr><th>Test</th>${c.tests[0].conditions.map(x => `<th>${esc(x.label)}</th>`).join('')}<th>Source</th></tr></thead>
    <tbody>${c.tests.map(t => `<tr><td><b>${esc(t.id)}</b></td>${t.conditions.map(x => `<td class="${x.ok ? 'hit' : 'miss'}">${x.ok ? '✓' : '✕'} ${esc(x.recorded)}</td>`).join('')}
      <td>${esc(t.sourceLocation)}${t.untied ? '<br><span class="note">The table can’t tie this test’s oxygen to one airflow reading.</span>' : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// Fabric and Nomex: every test as the report lists it, with what happened in the server's words.
const outcomeRows = ev => ev.tests.map(t => `<tr><td><b>${esc(t.id)}</b></td><td class="n">${esc(ev.set === 'nomex' ? t.date : t.width)}</td><td class="n">${esc(t.flowText)}</td><td class="n">${esc(t.oxygenText)}</td><td>${esc(t.happened)}</td>${ev.airflow !== null ? `<td>${esc(t.atYourAirflow)}</td>` : ''}</tr>`).join('');
const outcomeTable = ev => `<div class="tbl"><table><thead><tr><th>Test</th><th>${ev.set === 'nomex' ? 'Date' : 'Width'}</th><th>Airflow</th><th>O₂</th><th>What happened</th>${ev.airflow !== null ? `<th>At ${esc(ev.airflow)} cm/s</th>` : ''}</tr></thead><tbody>${outcomeRows(ev)}</tbody></table></div>`;
function renderOutcomes(ev) {
  $('#s2').textContent = 'What NASA saw';
  $('#s2-aside').textContent = 'Every matching test, as the report lists it';
  $('#panel2').innerHTML = `
    <div class="mat-row"><div class="mat"><b>${esc(ev.label)}</b><span>${esc(ev.source.name)}</span></div></div>
    ${outcomeTable(ev)}
    <p class="finding"><b>${esc(ev.finding.lead)}</b> ${esc(ev.finding.text)}</p>
    <p class="caveat">${esc(ev.caveat)}</p>
    ${relatedHtml(result.related)}`;
}

// A result from a separate experiment (Saffire-II), shown beside the answer and never inside it.
const relatedHtml = r => r ? `<p class="also-seen"><b>Also seen in another experiment.</b> ${esc(r.text)} <a href="${esc(r.source.url)}" target="_blank" rel="noopener">${esc(r.source.label)}</a></p>` : '';

function renderChart(ev) {
  const W = 560, H = 300, L = 50, R = 14, T = 16, B = 44, xMax = 22, yMax = 0.16;
  const x = v => L + v / xMax * (W - L - R), y = s => T + (1 - s / yMax) * (H - T - B);
  const on = new Set(ev.ids);
  let h = '';
  for (const s of [0, 0.04, 0.08, 0.12, 0.16]) h += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(s)}" y2="${y(s)}"/><text class="ax" x="${L - 8}" y="${y(s) + 3.5}" text-anchor="end">${s.toFixed(2)}</text>`;
  for (const v of [0, 5, 10, 15, 20]) h += `<text class="ax" x="${x(v)}" y="${H - B + 17}" text-anchor="middle">${v}</text>`;
  h += `<line class="base" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
  h += `<text class="ax-t" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Airflow against the flame (cm/s)</text>`;
  h += `<text class="ax-t" transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Flame spread (mm/s)</text>`;
  if (ev.airflow !== null && ev.airflow <= xMax) h += `<line class="guide" x1="${x(ev.airflow)}" x2="${x(ev.airflow)}" y1="${T}" y2="${y(0)}"/><text class="guide-t" x="${x(ev.airflow) + 5}" y="${T + 10}">your airflow</text>`;
  const tracked = records.filter(r => r.spread);
  const order = [...tracked.filter(r => !on.has(r.id)), ...tracked.filter(r => on.has(r.id))];
  const pairs = r => r.velocity.map((v, i) => ({ v, s: r.spread[i] })).sort((a, b) => a.v - b.v);
  for (const r of order) {
    const col = on.has(r.id) ? `var(--t${r.thicknessMm})` : 'var(--mark-muted)';
    const pts = pairs(r);
    if (pts.length > 1) h += `<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="${on.has(r.id) ? 0.55 : 0.8}" points="${pts.map(p => x(p.v) + ',' + y(p.s)).join(' ')}"/>`;
    for (const p of pts) h += `<circle cx="${x(p.v)}" cy="${y(p.s)}" r="5" fill="${col}" stroke="var(--card)" stroke-width="2"/>`;
  }
  const f = ev.stats.fastest;
  if (f) {
    const fx = x(f.velocity), fy = y(f.spread), end = fx > W - 120;
    h += `<text class="dlabel" x="${fx + (end ? -10 : 10)}" y="${fy + 4}" text-anchor="${end ? 'end' : 'start'}">${esc(f.id)}, ${esc(f.spread)} mm/s</text>`;
  }
  for (const r of order) for (const p of pairs(r)) h += `<circle class="hit" cx="${x(p.v)}" cy="${y(p.s)}" r="11" tabindex="0" role="button" data-id="${r.id}" data-t="${r.thicknessMm}" data-v="${p.v}" data-s="${p.s}" aria-label="${r.id}, ${r.thicknessMm} millimetre sheet, ${p.v} centimetres per second, spread ${p.s} millimetres per second. Opens the source row."/>`;

  const wrap = $('#chart');
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Flame spread against airflow for the BASS-II acrylic sheet tests. Open the source rows for the full table.">${h}</svg><div class="tip" hidden></div>`;
  const tip = wrap.querySelector('.tip');
  const show = el => {
    const r = el.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(el.dataset.id)}</b>, ${esc(el.dataset.t)} mm sheet<br>Airflow ${esc(el.dataset.v)} cm/s, spread <b>${esc(el.dataset.s)}</b> mm/s<br>Tap for the source row`;
    tip.style.left = Math.min(Math.max(r.left + r.width / 2 - wr.left, 90), wr.width - 90) + 'px';
    tip.style.top = (r.top - wr.top + 6) + 'px';
    tip.hidden = false;
  };
  wrap.querySelectorAll('.hit').forEach(el => {
    el.addEventListener('pointerenter', () => show(el));
    el.addEventListener('focus', () => show(el));
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
    el.addEventListener('blur', () => { tip.hidden = true; });
    el.addEventListener('click', () => openProof([el.dataset.id]));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProof([el.dataset.id]); } });
  });
  $('#legend').innerHTML = ev.thickness === null
    ? `<span>Sheet thickness</span>${THICKNESSES.map(n => `<span><i class="sw sw${n}"></i>${n} mm</span>`).join('')}<span>Lines join readings from one test</span>`
    : `<span><i class="sw sw${ev.thickness}"></i>${ev.thickness} mm sheets</span><span><i class="sw swm"></i>Other tests</span><span>Lines join readings from one test</span>`;
}

// ---------- Proof: the source rows behind any number ----------
function openProof(ids) {
  const body = $('#proof-body');
  if (ids === 'gap') {
    const E = result.envelope;
    $('#proof-title').textContent = 'The sources behind this gap';
    body.innerHTML = `<div class="cite"><b>What this set of NASA tests covers overall</b><span>${esc(E.summary)}</span><span>${esc(E.pressureNote)}</span><span>${esc(result.applicability.policy)}</span></div>
      ${result.sources.map(s => `<div class="cite"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></div>`).join('')}
      <p class="note">Oxygen and nitrogen partial pressures are calculated from each cabin’s total pressure and oxygen share.</p>`;
  } else if (ids && ids.kind === 'outcomes') {
    const ev = ids;
    $('#proof-title').textContent = `The ${ev.tests.length} rows behind this answer`;
    body.innerHTML = `<div class="cite"><b>${esc(ev.source.name)}</b><span>Copied from the report, with each test’s own comment or note.</span><a href="${esc(ev.source.url)}" target="_blank" rel="noopener">Open the report on NASA NTRS</a></div>
      ${outcomeTable(ev)}
      <p class="note">${esc(ev.caveat)} Transcribed with AI assistance and checked against the page images; an independent human check is pending.</p>`;
  } else {
    const list = ids || records.map(r => r.id);
    const rows = records.filter(r => list.includes(r.id));
    $('#proof-title').textContent = rows.length === 1 ? `Test ${rows[0].id}, as NASA reported it` : `The ${rows.length} rows behind this answer`;
    body.innerHTML = `<div class="cite"><b>NASA/TM-20210011385, Table 5.1, printed p. 57</b><span>BASS-II acrylic (PMMA) sheets with opposed airflow, in microgravity aboard the ISS. NASA PSI-25, DOI 10.60555/4qc4-de67.</span><a href="https://ntrs.nasa.gov/citations/20210011385" target="_blank" rel="noopener">Open the report on NASA NTRS</a></div>
      <div class="tbl"><table>
        <thead><tr><th>Test</th><th>Sheet</th><th>Width</th><th>Sides</th><th>Airflow → spread</th><th>Burned</th><th>O₂ start → end</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td><b>${r.id}</b></td><td class="n">${r.thicknessMm} mm</td><td class="n">${r.widthMm} mm</td><td class="n">${r.burningSides}</td>
          <td class="n">${r.spread ? r.velocity.map((v, i) => `${v} cm/s → ${r.spread[i]} mm/s`).join('<br>') : `<span class="nt">Not tracked</span> at ${r.velocity.join(', ')} cm/s`}</td>
          <td class="n">${r.burnMin} min</td><td class="n">${r.oxygenInitial}% → ${r.oxygenFinal}%</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="note">Blank spread cells in the report mean the spread was not tracked, not zero. Oxygen values are the start and end of each test, not a constant level. Transcribed by our team. The oxygen values match NASA’s own PSI-25 table; an independent check of the other columns is pending.</p>
      ${rows.length < records.length ? '<div><button class="btn alt" type="button" id="all-rows">Show all 20 rows</button></div>' : ''}`;
    $('#all-rows')?.addEventListener('click', () => openProof(null));
  }
  const dialog = $('#proof');
  if (!dialog.open) dialog.showModal();
  body.scrollTop = 0;
}
$('#open-proof').addEventListener('click', () => { if (result) openProof(!result.evidence ? 'gap' : result.evidence.kind === 'outcomes' ? result.evidence : result.evidence.ids); });
$('#proof').addEventListener('click', e => { if (e.target === e.currentTarget || e.target.closest('[data-close]')) e.currentTarget.close(); });
function renderProofText() {
  const ev = result.evidence, unclear = result.verdict.state === 'unresolved';
  $('#open-proof').hidden = unclear;
  $('#proof-text').textContent = unclear ? 'Nothing was answered, so there are no source rows for this question yet.'
    : ev ? (ev.kind === 'outcomes' ? 'Every row above is copied from NASA’s report, with its own comment. Nothing here is generated.' : 'Every number, dot and card opens its row in NASA’s report. Nothing here is generated.')
    : 'Every gap above links to its NASA or journal source, next to what the tests in this set do cover.';
  $('#open-proof').textContent = ev ? `Open the ${ev.ids.length} source rows` : 'Open the sources';
}

// ---------- Ranked findings: computed on the server over all 20 acrylic tests. The page only lays them out. ----------
// One dot per reading pair, filled when it agrees, so a small sample looks small.
const agreeText = x => `${x.agree} of ${x.comparisons} reading pair${x.comparisons === 1 ? '' : 's'} agree, from ${x.tests} test${x.tests === 1 ? '' : 's'}`;
const dotsHtml = x => `<span class="dots" role="img" aria-label="${esc(agreeText(x))}">${'<i class="y"></i>'.repeat(x.agree)}${'<i></i>'.repeat(x.comparisons - x.agree)}</span>`;
const tierHtml = x => `<span class="tier ${esc(x.tier)}">${esc(x.tierLabel)}</span>`;
function renderFindings(f) {
  $('#findings-body').innerHTML = `<ol class="rank" role="list">${f.ranked.map(x => `<li class="${esc(x.tier)}">
      <span class="rn" aria-hidden="true">${esc(x.rank)}</span>
      <div class="rb"><p class="rl"><b>${esc(x.lead)}</b> ${esc(x.text)}</p>
        <p class="rc">Matched on ${esc(x.matchedOn.join(', '))}. Not matched: ${esc(x.notMatched.join(', '))}.</p>
        <p class="rc">${esc(x.caveat)}</p></div>
      <div class="rs">${tierHtml(x)}<span class="rcount">${esc(agreeText(x))}</span>${dotsHtml(x)}
        ${x.ids.length ? `<button type="button" class="rank-go" data-ids="${esc(x.ids.join(','))}" aria-label="Open the ${esc(x.ids.length)} source rows behind finding ${esc(x.rank)}">${esc(x.ids.length)} source rows</button>` : ''}</div>
    </li>`).join('')}</ol>
    <p class="note">${esc(f.caveat)}</p>
    <details class="rank-how"><summary>How this ranking works</summary><p>${esc(f.method)} ${esc(f.rule)}</p></details>`;
  $('#findings-preview').innerHTML = f.ranked.map(x => `<li class="${esc(x.tier)}">
      <span class="rn" aria-hidden="true">${esc(x.rank)}</span>
      <div><p class="rl"><b>${esc(x.lead)}</b></p><p class="rcount">${esc(agreeText(x))}</p>${dotsHtml(x)}</div>
      ${tierHtml(x)}</li>`).join('');
}
$('#findings-body').addEventListener('click', e => { const b = e.target.closest('.rank-go'); if (b) openProof(b.dataset.ids.split(',')); });

// ---------- NASA's fire response: quoted steps, and the evidence behind each ----------
// Shown the same way for every answer, so a verdict never turns into a danger level.
function renderFireResponse(fr) {
  const cite = s => s ? ` <a class="src" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.name)}">${esc(s.label)}</a>` : '';
  const date = new Date(fr.source.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  $('#fire-response').innerHTML = `
    <p class="fr-intro">From <a href="${esc(fr.source.url)}" target="_blank" rel="noopener">${esc(fr.source.name)}</a>, ${esc(date)}, ${esc(fr.source.location)}: “${esc(fr.source.intro)}”</p>
    <p class="note">${esc(fr.source.caveat)} This app quotes the steps in NASA’s order. It doesn’t choose, reorder or rank them, and a Burned answer is not a danger level. Next to each step is what microgravity tests say about it.</p>
    <ol class="fr-steps" role="list">${fr.steps.map(s => `<li>
      <span class="rn" aria-hidden="true">${esc(s.n)}</span>
      <div class="fr-body">
        <p class="fr-q">“${esc(s.step)}”</p>${s.detail ? `<p class="fr-d">“${esc(s.detail)}”</p>` : ''}
        ${s.evidence.length ? `<ul class="fr-ev">${s.evidence.map(e => `<li>${esc(e.text)}${cite(e.source)}</li>`).join('')}</ul>` : '<p class="fr-none">No test in the sets we mapped measured this step.</p>'}
        ${s.differs ? `<p class="fr-diff"><b>Sources differ.</b> ${esc(s.differs.text)}${cite(s.differs.source)}</p>` : ''}
      </div>
      <span class="fr-status ${esc(s.status)}">${esc(s.statusLabel)}</span>
    </li>`).join('')}</ol>
    <p class="note">${fr.limitations.map(t => esc(t)).join(' ')}</p>`;
  $('#response-preview').innerHTML = fr.steps.map(s => `<li>
      <span class="rn" aria-hidden="true">${esc(s.n)}</span><span class="fr-t" title="${esc(s.step)}">${esc(s.step)}</span>
      <span class="fr-status ${esc(s.status)}">${esc(s.statusLabel)}</span></li>`).join('');
}

// ---------- Chamber flame (an illustration, labelled as one) ----------
const flame = (() => {
  const cv = $('#flame'), ctx = cv.getContext('2d');
  const UI = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  let W = 0, H = 0, g = 0, gT = 0, known = false, lit = true, raf = 0, visible = true;
  function size() {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function shape(cx, cy, R, gg, t) {
    const pts = [];
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * Math.PI * 2, up = Math.cos(a);
      let r = R * (1 + 0.03 * Math.sin(3 * a + t * 2.1) + 0.02 * Math.sin(5 * a - t * 3.3) + 0.012 * Math.sin(7 * a + t * 1.7));
      if (up > 0) r *= 1 + gg * 2.5 * Math.pow(up, 2.2) * (1 + 0.07 * Math.sin(t * 6.5 + a * 2)); else r *= 1 - gg * 0.28 * (-up);
      let px = Math.sin(a) * r; const py = -Math.cos(a) * r;
      if (up > 0) { px *= 1 - gg * 0.5 * Math.pow(up, 1.2); px += gg * R * 0.14 * Math.pow(up, 3) * Math.sin(t * 3.1); }
      pts.push([cx + px, cy + py]);
    }
    return pts;
  }
  function trace(pts) { ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); }
  function fuel(cx, cy, r) { ctx.save(); ctx.fillStyle = '#2c2c2e'; ctx.strokeStyle = '#48484a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
  function micro(cx, cy, R, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let gr = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.9);
    gr.addColorStop(0, 'rgba(70,100,255,0.22)'); gr.addColorStop(1, 'rgba(70,100,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 26; ctx.shadowColor = 'rgba(80,120,255,0.9)';
    trace(shape(cx, cy, R, 0, t));
    gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.07);
    gr.addColorStop(0, 'rgba(20,30,110,0)'); gr.addColorStop(0.58, 'rgba(40,70,220,0.10)'); gr.addColorStop(0.86, 'rgba(90,130,255,0.62)');
    gr.addColorStop(0.96, 'rgba(175,195,255,0.92)'); gr.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = gr; ctx.fill(); ctx.restore();
    fuel(cx, cy, R * 0.16);
  }
  function earth(cx, cy, R, t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(255,140,40,0.85)';
    trace(shape(cx, cy, R, 1, t));
    const gr = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.05, cx, cy - R * 0.6, R * 3.3);
    gr.addColorStop(0, 'rgba(255,250,228,0.97)'); gr.addColorStop(0.2, 'rgba(255,214,110,0.92)'); gr.addColorStop(0.48, 'rgba(255,148,40,0.72)');
    gr.addColorStop(0.8, 'rgba(230,80,10,0.32)'); gr.addColorStop(1, 'rgba(200,50,0,0)');
    ctx.fillStyle = gr; ctx.fill();
    ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(80,120,255,0.8)'; ctx.fillStyle = 'rgba(80,120,255,0.5)';
    ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.5, R * 0.62, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    fuel(cx, cy + R * 0.72, R * 0.16);
  }
  function unknown(cx, cy, R, gg, t) {
    const pts = shape(cx, cy, R, gg, reduced ? 0 : t * 0.6);
    ctx.save();
    ctx.fillStyle = 'rgba(255,214,10,0.05)'; trace(pts); ctx.fill();
    ctx.setLineDash([7, 7]); ctx.lineDashOffset = reduced ? 0 : -t * 14;
    ctx.strokeStyle = 'rgba(255,214,10,0.85)'; ctx.lineWidth = 2; trace(pts); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,214,10,0.92)'; ctx.font = `600 ${Math.round(R * 0.9)}px ${UI}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', cx, cy - R * 0.3 - R * gg * 0.9);
    ctx.restore();
    fuel(cx, cy + R * 0.5, R * 0.16);
  }
  function grid() {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    for (let gx = 0; gx < W; gx += 24) { ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 24) { ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke(); }
    ctx.restore();
  }
  function frame(ms) {
    const t = reduced ? 0 : ms / 1000;
    g += (gT - g) * (reduced ? 1 : 0.08);
    ctx.clearRect(0, 0, W, H); grid();
    const R = Math.min(W, H) * 0.15;
    if (!lit) fuel(W * 0.58, H * 0.5, R * 0.16);
    else if (known) {
      micro(W * 0.58, H * 0.5, R, t);
      const rx = W * 0.15, ry = H * 0.56, rr = Math.min(W, H) * 0.042;
      earth(rx, ry, rr, t);
      ctx.save(); ctx.fillStyle = 'rgba(235,235,245,0.6)'; ctx.font = `500 11px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText('Earth, 1 g', rx, ry + rr * 2.2); ctx.restore();
    } else unknown(W * 0.58, H * 0.56, R, g, t);
    if (!reduced && visible) raf = requestAnimationFrame(frame);
  }
  function start() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  new ResizeObserver(() => { size(); start(); }).observe(cv);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); }).observe(cv);
  return { set(gg, isKnown, isLit = true) { gT = Math.min(gg, 1); known = isKnown; lit = isLit; if (reduced) g = gT; start(); } };
})();

function render(animate) { renderRead(); renderTiles(); renderVerdict(animate); renderKpis(); renderPanel2(); renderProofText(); }

// ---------- Boot: load the tables once, then answer the first suggestion ----------
(async () => {
  try {
    const data = await api('/api/data');
    records = data.records;
    renderFireResponse(data.fireResponse);
    if (data.findings) renderFindings(data.findings);
  } catch (error) {
    showVerdictState('unavailable', 'Unavailable', '', 'NASA’s tests didn’t load.', unreachable(error), '');
    $('#panel2').innerHTML = '<p class="note">Nothing to show until the tests load.</p>';
    $('#open-proof').hidden = true;
    return;
  }
  input.value = QUESTIONS[0];
  await controller.ask(QUESTIONS[0]);
})();
