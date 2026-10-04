const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const escape=s=>String(s??'Unknown').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const steps=['ask','compare','brief'];
let all=[],results=[],provenance,brief=null,selected=new Set(),searchVersion=0,briefVersion=0,comparisonVersion=0,step='ask',writing=false,searchReady=false;
const status=message=>$('#status').textContent=message;
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
async function api(path,options){const r=await fetch(path,options);const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}

function setStep(name,{push=true,focus=true}={}){
  if(name==='brief'&&!searchReady){status('Run Find evidence for your updated question and filters before creating a brief.');return;}
  step=steps.includes(name)?name:'ask';
  for(const p of $$('.panel'))p.hidden=p.id!==step;
  for(const b of $$('[data-step]'))b.dataset.step===step?b.setAttribute('aria-current','step'):b.removeAttribute('aria-current');
  if(push&&location.hash!=='#'+step)history.pushState(null,'','#'+step);
  status('');
  if(step==='compare')renderComparison();
  if(step==='brief'&&!brief&&!writing)generate();
  renderTray();
  if(focus){if($('.steps').getBoundingClientRect().top<0)$('.steps').scrollIntoView();$(`#${step} h2`).focus({preventScroll:true});}
}
addEventListener('popstate',()=>setStep(location.hash.slice(1),{push:false}));

function renderProgress(){
  $('#hint-ask').textContent=!searchReady?'Search needs updating':results.length?`${plural(results.length,'test')} found`:'No matching tests';
  $('#hint-compare').textContent=selected.size?`${selected.size} selected`:'Pick 2 or 3 tests';
  $('#hint-brief').textContent=brief?(brief.abstained?'Insufficient evidence':'Ready to export'):writing?'Writing…':'Not written yet';
  const ready={ask:results.length>0,compare:selected.size>=2,brief:!!brief&&!brief.abstained};
  for(const b of $$('[data-step]'))b.classList.toggle('ready',ready[b.dataset.step]);
}

function renderTray(){
  const n=selected.size,canBrief=searchReady&&(n||results.length);
  const chips=[...selected].map(id=>`<button type="button" class="chip" data-remove="${escape(id)}" aria-label="Remove ${escape(id)} from selection">${escape(id)} <span aria-hidden="true">×</span></button>`).join('');
  const info=n?`<span class="tray-label">Selected</span>${chips}${step==='ask'&&n<2?'<span class="tray-hint">Pick one more to compare.</span>':''}`
    :`<span class="tray-hint">${step==='brief'?'No tests selected, so the brief uses your search results.':'Select 2 or 3 tests to compare them side by side.'}</span>`;
  const actions={
    ask:`<button type="button" class="secondary" data-go="brief" ${canBrief?'':'disabled'}>${n?'Skip to brief':'Brief these results'}</button><button type="button" class="primary" data-go="compare" ${n<2?'disabled':''}>${n<2?'Compare tests':`Compare ${n} tests`}</button>`,
    compare:`<button type="button" class="secondary" data-go="ask">Back to evidence</button><button type="button" class="primary" data-go="brief" ${canBrief?'':'disabled'}>Write evidence brief</button>`,
    brief:`<button type="button" class="secondary" data-go="ask">Change evidence</button><button type="button" class="primary" data-export ${brief?'':'disabled'}>Export Markdown</button>`
  }[step];
  $('#tray-row').innerHTML=`<div class="tray-info">${info}</div><div class="tray-actions">${actions}</div>`;
}

function invalidate(regenerate=true){
  brief=null;briefVersion++;writing=false;
  if(regenerate&&step==='brief'&&searchReady)generate();else{$('#brief-content').innerHTML='';$('#brief-basis').textContent='';}
}

function markSearchDirty(){
  searchReady=false;searchVersion++;invalidate(false);
  $('#results').removeAttribute('aria-busy');
  renderProgress();renderTray();
}

function toggle(id){
  if(selected.has(id))selected.delete(id);
  else if(selected.size>=3){status('You can compare up to three tests. Remove one to add another.');return;}
  else selected.add(id);
  status('');
  for(const b of $$('[data-select]')){const on=selected.has(b.dataset.select);b.setAttribute('aria-pressed',on);b.textContent=on?'Selected':'Select';b.closest('.card').classList.toggle('picked',on);}
  invalidate();renderTray();renderProgress();
  if(step==='compare')renderComparison();
}

const activeFilters=()=>{const f=new FormData($('#search-form'));return Number(f.get('thickness')!=='')+Number(f.get('oxygenMin')!==''||f.get('oxygenMax')!=='');};
function clearFilters(){for(const el of $$('.refine select,.refine input'))el.value='';runSearch();}

async function runSearch(e){
  e?.preventDefault();
  markSearchDirty();
  const version=++searchVersion,form=new FormData($('#search-form')),min=form.get('oxygenMin'),max=form.get('oxygenMax'),n=activeFilters();
  $('#filter-count').hidden=$('#reset').hidden=!n;$('#filter-count').textContent=n?`${n} active`:'';
  if(min!==''&&max!==''&&+min>+max){status('Minimum oxygen must be less than or equal to maximum.');return;}
  $('#results').setAttribute('aria-busy','true');
  try{
    const d=await api('/api/search?'+new URLSearchParams(form));
    if(version!==searchVersion)return;
    results=d.records;searchReady=true;status('');renderResults(d.reason);invalidate();renderTray();renderProgress();
  }catch(err){if(version===searchVersion)status(err.message);}
  finally{if(version===searchVersion)$('#results').removeAttribute('aria-busy');}
}

function renderResults(reason){
  $('#result-count').textContent=plural(results.length,'test');
  $('#results').innerHTML=results.length?results.map(r=>{const on=selected.has(r.id);return `<article class="card${on?' picked':''}">
<div class="card-top"><span class="id-tag">${r.id}</span><h3>${r.thicknessMm} mm PMMA sheet, ${r.burningSides===1?'one':'two'}-sided burning</h3><button type="button" class="select" data-select="${r.id}" aria-pressed="${on}" aria-label="Select ${r.id} for comparison">${on?'Selected':'Select'}</button></div>
<p class="conditions">Opposed flow, width ${r.widthMm} mm, initial → final O₂ ${r.oxygenInitial} → ${r.oxygenFinal} vol%</p>
<div class="pairs">${r.spread?`<span class="pairs-unit">Airflow cm/s → spread mm/s</span>`+r.velocity.map((v,j)=>`<strong class="pair">${v} → ${r.spread[j]}</strong>`).join(''):'<span class="pair none">Spread rate not tracked. No value inferred.</span>'}</div>
<div class="card-bottom"><button type="button" data-source="${r.id}">Source: Table 5.1, row ${r.id}</button><details><summary>Why this result, and what is missing</summary><p>${r.rankReasons.map(escape).join('. ')}.</p><p>Missing: ${r.missing.map(escape).join(', ')}.</p></details></div></article>`;}).join('')
    :`<div class="empty"><strong>No matching evidence</strong><p>${escape(reason||'No tests match these conditions.')}</p><p>This collection covers PMMA sheets in opposed flow only. Try one of the example questions above${activeFilters()?', or clear the filters':''}.</p>${activeFilters()?'<button type="button" class="secondary" data-clear-filters>Clear filters</button>':''}</div>`;
}

$('#search-form').onsubmit=runSearch;
$('#question').addEventListener('input',markSearchDirty);
$('.refine').addEventListener('input',markSearchDirty);
$('.refine').addEventListener('change',()=>runSearch());
$('#reset').onclick=clearFilters;
$$('[data-example]').forEach(b=>b.onclick=()=>{$('#question').value=b.dataset.example;runSearch();});
$$('[data-step]').forEach(b=>b.onclick=()=>setStep(b.dataset.step));
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.go)setStep(b.dataset.go);
  else if(b.dataset.select)toggle(b.dataset.select);
  else if(b.dataset.remove){toggle(b.dataset.remove);$('#tray-row button')?.focus();}
  else if(b.dataset.source)showSource(b.dataset.source);
  else if('export' in b.dataset)exportBrief();
  else if('retry' in b.dataset)generate();
  else if('clearFilters' in b.dataset)clearFilters();
});

function showSource(id){const r=all.find(x=>x.id===id);$('#source-content').innerHTML=`<span class="badge">${r?'Published measurement · '+r.id:'Corpus provenance'}</span><p>${escape(provenance.location)}</p>${r?`<pre>${escape(JSON.stringify({test:r.id,thickness_mm:r.thicknessMm,width_mm:r.widthMm,velocity_cm_s:r.velocity,spread_mm_s:r.spread,initial_o2_vol_pct:r.oxygenInitial,final_o2_vol_pct:r.oxygenFinal},null,2))}</pre>`:''}<p>${escape(provenance.method)}</p><p><strong>Verification:</strong> ${escape(provenance.verification)}</p><ul>${provenance.limitations.map(x=>`<li>${escape(x)}</li>`).join('')}</ul><p><a href="${provenance.source}" target="_blank" rel="noopener">Open NASA report ↗</a> · <a href="${provenance.pdf}" target="_blank" rel="noopener">PDF (printed p. 57) ↗</a></p><p>Dataset DOI: ${escape(provenance.doi)} · Retrieved ${provenance.accessed}</p>`;$('#source-dialog').showModal();}
$('#close-dialog').onclick=()=>$('#source-dialog').close();$('#provenance-open').onclick=()=>showSource();

async function renderComparison(){
  const version=++comparisonVersion,selectionKey=[...selected].join(',');
  if(selected.size<2){$('#comparison').innerHTML=`<div class="empty"><strong>${selected.size?'Pick one more test':'No tests selected yet'}</strong><p>Choose two or three tests in step 1, then compare their conditions here.</p><button type="button" class="secondary" data-go="ask">Back to evidence</button></div>`;return;}
  $('#comparison').innerHTML='<div class="empty">Loading selected tests…</div>';
  try{
    const d=await api('/api/compare?ids='+selectionKey);
    if(version!==comparisonVersion||selectionKey!==[...selected].join(','))return;
    const fields=[['Material','material'],['Geometry','geometry'],['Thickness, mm','thicknessMm'],['Width, mm','widthMm'],['Burning sides','burningSides'],['Flow direction','flowDirection'],['Velocity, cm/s','velocity'],['Spread, mm/s','spread'],['Initial O₂, vol%','oxygenInitial'],['Final O₂, vol%','oxygenFinal'],['Burn time, min','burnMin'],['Measurement uncertainty','uncertainty']];
    $('#comparison').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Experimental condition</th>${d.records.map(r=>`<th>${r.id}</th>`).join('')}</tr></thead><tbody>${fields.map(([label,key])=>{const differs=new Set(d.records.map(r=>JSON.stringify(r[key]))).size>1;return `<tr${differs?' class="differs"':''}><td>${label}${differs?' <span class="tag">differs</span>':''}</td>${d.records.map(r=>`<td>${escape(Array.isArray(r[key])?r[key].join(' / '):r[key]??'Not reported / tracked')}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div><div class="warning"><h3>${escape(d.status)}</h3><ul>${d.issues.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></div>`;
  }catch(err){if(version===comparisonVersion&&selectionKey===[...selected].join(','))status(err.message);}
}

async function generate(){
  if(!searchReady){status('Run Find evidence before creating a brief.');return;}
  const version=++briefVersion;writing=true;renderProgress();
  $('#brief-basis').textContent='';$('#brief-content').innerHTML='<div class="empty">Writing a source-linked brief…</div>';
  try{
    const d=await api('/api/brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:$('#question').value,ids:selected.size?[...selected]:results.map(r=>r.id),ai:$('#use-ai').checked})});
    if(version!==briefVersion)return;
    brief=d;renderBrief();
  }catch(err){
    if(version!==briefVersion)return;
    $('#brief-content').innerHTML=`<div class="empty"><strong>The brief could not be written</strong><p>${escape(err.message)}</p><button type="button" class="secondary" data-retry>Try again</button></div>`;
  }finally{if(version===briefVersion){writing=false;renderProgress();renderTray();}}
}

function renderBrief(){
  const ids=brief.claims.map(c=>c.id);
  const method=brief.mode.startsWith('AI-selected')?'AI selected the evidence.':'Deterministic evidence selection.';
  $('#brief-basis').textContent=brief.abstained?'':`Based on ${ids.length} of ${selected.size||results.length} ${selected.size?'selected tests':'matching search results'}: ${ids.join(', ')}. ${method}`;
  $('#brief-content').innerHTML=`<span class="badge">${escape(brief.mode)}</span>${brief.notice?`<p class="warning">${escape(brief.notice)}</p>`:''}<div class="brief-section"><h3>Research question</h3><p>${escape(brief.question)}</p></div>`+(brief.abstained?`<div class="warning"><h3>Insufficient evidence</h3><p>${escape(brief.reason)}</p></div>`:`<div class="brief-section"><h3>What was observed</h3>${brief.claims.map(c=>`<p>${escape(c.text)}<br><a href="${c.source}" target="_blank" rel="noopener">${escape(c.location)} ↗</a></p>`).join('')}</div><div class="brief-section"><h3>Under which conditions</h3>${brief.claims.map(c=>`<p><strong>${c.id}</strong>: ${escape(c.conditions)}</p>`).join('')}</div><div class="brief-section"><h3>What this means</h3><span class="badge">App-generated explanation</span><p>${escape(brief.interpretation)}</p></div><div class="brief-section"><h3>What remains unknown</h3><ul>${brief.gaps.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></div>`);
}
$('#use-ai').onchange=invalidate;

function exportBrief(){if(!brief)return;const lines=['# FlameScope evidence brief','',`Question: ${brief.question}`,`Mode: ${brief.mode}`,''];if(brief.abstained)lines.push('## Insufficient evidence',brief.reason);else{lines.push('## Observations',...brief.claims.flatMap(c=>[c.text,c.conditions,`Source: ${c.source} — ${c.location}`,'']),'## Interpretation (app-generated)',brief.interpretation,'## Evidence gaps',...brief.gaps.map(x=>'- '+x),'',`Verification: ${provenance.verification}`,`Dataset DOI: ${provenance.doi}`);}if(brief.notice)lines.push('',brief.notice);const blob=new Blob([lines.join('\n')],{type:'text/markdown'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='flamescope-evidence-brief.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

try{
  const d=await api('/api/data');all=d.records;provenance=d.provenance;
  $('#ai-option').hidden=!d.aiAvailable;
  $('#ai-status').textContent=d.aiAvailable?'AI only selects from published statements. The wording stays fixed.':'Offline mode: the brief uses fixed evidence templates.';
  await runSearch();
  setStep(location.hash.slice(1),{push:false,focus:false});
}catch(err){status('Unable to load dataset. '+err.message);}
