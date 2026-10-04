import test from 'node:test';
import assert from 'node:assert/strict';
import { records, search, comparison, makeBrief } from '../src/compute/evidence.mjs';
import { createServer } from '../src/api/server.mjs';

test('20 unique source-located records; paired units and missingness preserved',()=>{
  assert.equal(records.length,20);assert.equal(new Set(records.map(r=>r.id)).size,20);
  for(const r of records){assert.match(r.sourceLocation,new RegExp(`row ${r.id}$`));if(r.spread)assert.equal(r.velocity.length,r.spread.length);assert.equal(r.velocityUnit,'cm/s');}
  assert.deepEqual(records.filter(r=>!r.spread).map(r=>r.id),['M6','M12']);
});
test('reported M2 and M8 paired differences reproduce independently calculated references',()=>{
  // Published Table 5.1: M2 0.052 -> 0.033; M8 0.057 -> 0.040 mm/s.
  const m2=records.find(r=>r.id==='M2'),m8=records.find(r=>r.id==='M8');
  assert.ok(Math.abs((m2.spread[0]-m2.spread[1])-0.019)<1e-10);
  assert.ok(Math.abs((m8.spread[0]-m8.spread[2])-0.017)<1e-10);
  assert.deepEqual(m2.velocity,[20,15]);assert.equal(m8.widthMm,12);
  // Arithmetic reproduction only: not independent experimental/scientific validation.
});
test('filters use initial oxygen, not endpoints as a constant range',()=>{
  const d=search({oxygenMin:'21',oxygenMax:'23',thickness:'3'});
  assert.deepEqual(d.records.map(r=>r.id),['M2','M5']);
});
test('missing spread tests stay searchable and are not treated as zero',()=>{
  assert.deepEqual(search({question:'Which PMMA tests have missing spread rates?'}).records.map(r=>r.id),['M6','M12']);
  assert.match(makeBrief('M6 flame spread',[records[5]]).claims[0].text,/not tracked/);
});
test('incompatible geometry, units and missing oxygen surface as limitations',()=>{
  const a=records[0],b={...records[1],geometry:'rod',oxygenInitial:null,velocityUnit:'m/s'};
  const d=comparison([a,b]);assert.equal(d.causal,false);
  for(const pattern of [/Different geometry/,/Missing initial oxygen/,/Incompatible/,/not independent/])assert.ok(d.issues.some(x=>pattern.test(x)));
});
test('brief cannot cite a requested test absent from selected evidence',()=>{
  assert.equal(makeBrief('M1 flame spread',[records[6]]).abstained,true);
});
test('unsupported safety question abstains despite selected records',()=>{
  const d=makeBrief('Is PMMA safe for spacecraft?',records);assert.equal(d.abstained,true);assert.equal(d.claims.length,0);
});
test('API validates requests and serves local data',async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{const base=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await (await fetch(base+'/api/data')).json()).records.length,20);
    assert.equal((await fetch(base+'/api/compare?ids=M1')).status,400);
    const bad=await fetch(base+'/api/brief',{method:'POST',body:JSON.stringify({question:'PMMA',ids:['fake']})});assert.equal(bad.status,400);
    const cross=await fetch(base+'/api/brief',{method:'POST',headers:{Origin:'https://example.com'},body:'{}'});assert.equal(cross.status,403);
    const good=await fetch(base+'/api/brief',{method:'POST',body:JSON.stringify({question:'M2 flame spread',ids:['M2']})});const d=await good.json();assert.equal(d.claims[0].id,'M2');assert.equal(d.mode,'Offline evidence brief');
    const research=await fetch(base+'/research/');assert.equal(research.status,200);assert.match(await research.text(),/FlameScope/);
    assert.equal((await fetch(base+'/research/app.js')).status,200);
    assert.equal((await fetch(base+'/research',{redirect:'manual'})).headers.get('location'),'/research/');
  }finally{await new Promise(r=>server.close(r));}
});
