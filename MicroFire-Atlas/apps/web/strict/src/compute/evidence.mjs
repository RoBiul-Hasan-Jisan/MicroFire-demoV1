import { readFileSync } from 'node:fs';

export const provenance = JSON.parse(readFileSync(new URL('../../data/provenance.json', import.meta.url)));
const csv = readFileSync(new URL('../../data/bass-table.csv', import.meta.url), 'utf8').trim();
export const records = csv.split(/\r?\n/).slice(1).map(line => {
  const [id,t,w,s,v,r,b,initial,final] = line.split(',');
  return { id, studyId: 'BASS-II', material: 'PMMA', geometry: 'sheet', flowDirection: 'opposed',
    thicknessMm: +t, widthMm: +w * 10, burningSides: +s, velocity: v.split(';').map(Number),
    spread: r ? r.split(';').map(Number) : null, burnMin: +b, oxygenInitial: +initial, oxygenFinal: +final,
    velocityUnit: 'cm/s', spreadUnit: 'mm/s', uncertainty: null, pressure: null, temperature: null,
    rawMedia: null, sourceLocation: `Table 5.1, printed p. 57, row ${id}`, source: provenance.source,
    missing: ['measurement uncertainty','pressure','temperature','per-segment oxygen','raw media linkage', ...(!r ? ['spread rate (not tracked)'] : [])] };
});

export function intent(question = '') {
  const q = question.toLowerCase();
  if (/\bsafe\b|safest|certif|recommend|fireproof|guarantee|safety score|oxygen limit|extinction threshold|predict|mars|moon|nomex|cotton|cellulose|droplet|concurrent|নিরাপদ|সুপারিশ/.test(q))
    return { supported: false, reason: 'This PMMA sheet subset cannot establish safety limits, certify materials, predict other environments, or answer questions about other fuels or flow regimes.' };
  if (/\bco2\b|\bco\b|carbon monoxide|pressure|temperature|uncertainty|calibration/.test(q))
    return { supported: false, reason: 'The requested measurement is not available in this curated table. Consult the original report and experimental records.' };
  const ids = [...q.matchAll(/\bm\d+\b/g)].map(x=>x[0].toUpperCase());
  if (ids.some(id=>!records.some(r=>r.id===id))) return { supported:false, reason:'At least one requested test is outside the curated M1–M20 subset.' };
  if (q.trim() && !/pmma|acrylic|flame|spread|airflow|flow|oxygen|o2|thick|width|burn|sheet|\bm\d+\b|আগুন|অক্সিজেন/.test(q))
    return { supported: false, reason: 'No supported combustion evidence was found for this question in the curated subset.' };
  return { supported: true, ids };
}

export function search({ question='', material='', geometry='', direction='', oxygenMin='', oxygenMax='', thickness='' }={}) {
  const analysis = intent(question);
  if (!analysis.supported) return { records: [], ...analysis };
  const selected = records.filter(r => (!material || r.material===material) && (!geometry || r.geometry===geometry) &&
    (!direction || r.flowDirection===direction) && (thickness==='' || r.thicknessMm===Number(thickness)) &&
    (oxygenMin==='' || r.oxygenInitial>=Number(oxygenMin)) && (oxygenMax==='' || r.oxygenInitial<=Number(oxygenMax)) &&
    (!analysis.ids.length || analysis.ids.includes(r.id)) && (!/missing|not tracked/i.test(question) || !r.spread));
  return { supported:true, records: selected.map(r=>({ ...r, rankReasons: [
    ...(analysis.ids.includes(r.id)?['Requested test ID']:[]),
    ...(/pmma|acrylic/i.test(question)?['Material matches question']:[]),
    ...(direction?['Flow-direction filter matches']:[]),
    ...(thickness!==''?['Thickness filter matches']:[]),
    ...(oxygenMin!=='' || oxygenMax!==''?['Initial O₂ falls within selected range']:[]),
    'Exact report table and row available', r.spread?'Published spread measurements available':'Spread not tracked; missing result retained'
  ], relevance: (analysis.ids.includes(r.id)?10:0)+(r.spread?1:0) })).sort((a,b)=>b.relevance-a.relevance || +a.id.slice(1)-+b.id.slice(1)) };
}

export function comparison(items) {
  const issues = [];
  const labels={material:'material',geometry:'geometry',flowDirection:'flow direction',thicknessMm:'thickness',widthMm:'width',burningSides:'number of burning sides',oxygenInitial:'initial oxygen',oxygenFinal:'final oxygen'};
  for (const key of ['material','geometry','flowDirection','thicknessMm','widthMm','burningSides']) {
    if (items.some(r=>r[key]==null)) issues.push(`Missing ${labels[key]}; comparability is unknown.`);
    else if (new Set(items.map(r=>r[key])).size>1) issues.push(`Different ${labels[key]}; this is not a controlled comparison.`);
  }
  for (const key of ['oxygenInitial','oxygenFinal']) {
    if (items.some(r=>r[key]==null)) issues.push(`Missing ${labels[key]}; oxygen conditions cannot be compared.`);
    else if (new Set(items.map(r=>r[key])).size>1) issues.push(`Different ${labels[key]}; oxygen is a confounding condition.`);
  }
  if (items.some(r=>r.velocityUnit!=='cm/s' || r.spreadUnit!=='mm/s')) issues.push('Incompatible or unrecognized units; numerical comparison blocked.');
  if (items.some(r=>!r.spread)) issues.push('Spread rate was not tracked for at least one test; no zero or inferred value is substituted.');
  issues.push('Oxygen endpoints do not establish constant or per-segment oxygen.','Pressure, temperature and measurement uncertainty are unavailable.','Shared investigation: these rows are not independent corroborating studies.');
  return { issues, status: 'Descriptive comparison only', causal: false };
}

export function claimsFor(items) {
  return items.map(r=>({ id:r.id, kind:'Published measurement', source:r.source, location:r.sourceLocation,
    text: r.spread ? `${r.id}: reported flow/spread pairs (cm/s → mm/s): ${r.velocity.map((v,i)=>`${v} → ${r.spread[i]}`).join('; ')}.` : `${r.id}: spread rate was not tracked; reported velocities are ${r.velocity.join(', ')} cm/s.`,
    conditions:`PMMA ${r.thicknessMm} mm sheet, width ${r.widthMm} mm, ${r.burningSides} burning side(s), opposed flow; initial/final O₂ ${r.oxygenInitial}/${r.oxygenFinal} vol%; burn duration ${r.burnMin} min.` }));
}

export function makeBrief(question, items, mode='Offline evidence brief', selectedIds=null) {
  const analysis=intent(question);
  if (!analysis.supported || !items.length) return { mode, abstained:true, reason:analysis.reason || 'No records match the selected conditions.', claims:[], question };
  const eligible=items.filter(r=>(!analysis.ids.length || analysis.ids.includes(r.id)) && (!/missing|not tracked/i.test(question) || !r.spread));
  const chosen=selectedIds ? eligible.filter(r=>selectedIds.includes(r.id)) : eligible.slice(0,5);
  if (!chosen.length) return { mode, abstained:true, reason:'No supported evidence selected.', claims:[], question };
  return { mode, abstained:false, question, claims:claimsFor(chosen),
    interpretation: 'These published measurements describe the selected tests. Differences in spread rates alone do not isolate an airflow effect or establish a material safety ranking.',
    interpretationKind:'App-generated explanation', gaps:comparison(chosen).issues,
    provenance, createdAt:new Date().toISOString() };
}
