import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { records, provenance, search, makeBrief, comparison } from '../compute/evidence.mjs';
import { ask, InputError } from '../compute/scenario.mjs';
import { FIRE_RESPONSE } from '../compute/response.mjs';
import { FINDINGS } from '../compute/findings.mjs';
import { aiAvailable, selectEvidence } from '../agents/evidence-selector.mjs';

const root=fileURLToPath(new URL('../../web/',import.meta.url));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
// vercel.json repeats this for the files Vercel serves itself; test/deploy.test.mjs keeps the two equal.
export const CSP="default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'";
// Only the loopback names of the port this server listens on. A page on another site can point its own
// domain at 127.0.0.1 (DNS rebinding), but its requests then carry that domain as Host, and are refused.
const localHosts=port=>['127.0.0.1','localhost','[::1]'].flatMap(h=>port===80?[h,`${h}:80`]:[`${h}:${port}`]);
// A hosted copy also answers to the names it's published under (ADR-014): PUBLIC_HOSTS, plus the ones Vercel sets.
export const publicHosts=(env=process.env)=>[...String(env.PUBLIC_HOSTS||'').split(','),env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL]
  .map(h=>String(h||'').trim().toLowerCase()).filter(Boolean);
const BRIEF_FIELDS=['question','ids','ai'];

export function createServer(options) { return http.createServer(createHandler(options)); }
export function createHandler({ hosts: published = publicHosts() } = {}) { return async(req,res)=>{
  try {
    const local=localHosts(req.socket.localPort), hosts=[...local,...published];
    const origins=[...local.map(h=>`http://${h}`),...published.map(h=>`https://${h}`)];
    if(!hosts.includes(String(req.headers.host||'').toLowerCase())) return send(res,403,{error:'Unexpected host.'});
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET' && url.pathname==='/api/data') return send(res,200,{records,provenance,fireResponse:FIRE_RESPONSE,findings:FINDINGS,aiAvailable:aiAvailable()});
    if(req.method==='GET' && url.pathname==='/api/search') return send(res,200,search(Object.fromEntries(url.searchParams)));
    if(req.method==='GET' && url.pathname==='/api/ask') {
      try { return send(res,200,ask(Object.fromEntries(url.searchParams))); }
      catch(error){ if(error instanceof InputError) return send(res,400,{error:error.message}); throw error; }
    }
    if(req.method==='GET' && url.pathname==='/api/compare') {
      const ids=(url.searchParams.get('ids') || '').split(',');
      const items=records.filter(r=>ids.includes(r.id));
      if(items.length<2 || items.length>3) return send(res,400,{error:'Select two or three distinct tests.'});
      return send(res,200,{records:items,...comparison(items)});
    }
    if(req.method==='POST' && url.pathname==='/api/brief') {
      if(req.headers.origin!==undefined && !origins.includes(String(req.headers.origin).toLowerCase())) return send(res,403,{error:'Cross-origin request refused.'});
      let body=''; for await(const chunk of req){body+=chunk; if(body.length>20000)return send(res,413,{error:'Request too large.'});}
      let input;try{input=JSON.parse(body);}catch{return send(res,400,{error:'Invalid JSON.'});}
      if(!input || typeof input!=='object' || Array.isArray(input)) return send(res,400,{error:'Send a JSON object with a question and test IDs.'});
      if(Object.keys(input).some(k=>!BRIEF_FIELDS.includes(k))) return send(res,400,{error:'Unknown field in the request. Use question, ids and ai.'});
      if(input.ai!==undefined && typeof input.ai!=='boolean') return send(res,400,{error:'ai must be true or false.'});
      if(typeof input.question!=='string' || input.question.length>2000 || !Array.isArray(input.ids) || input.ids.length>20 || input.ids.some(id=>typeof id!=='string' || !records.some(r=>r.id===id))) return send(res,400,{error:'Provide a question and valid test IDs.'});
      const items=records.filter(r=>input.ids.includes(r.id));
      let brief=makeBrief(input.question,items);
      if(input.ai===true && aiAvailable() && !brief.abstained) {
        try {
          const selected=await selectEvidence(input.question,items);
          brief=makeBrief(input.question,items,'AI-selected evidence · verified wording',selected.ids);
        }catch{brief.notice='AI selection unavailable. Showing the offline evidence brief; no generated scientific claims were accepted.';}
      } else if(input.ai===true) brief.notice=process.env.OFFLINE==='1'?'Offline mode. This brief uses deterministic evidence templates.':'AI is not configured. This brief uses deterministic evidence templates.';
      return send(res,200,brief);
    }
    if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
    // Will It Burn? is the home page; /burn/ was its old address.
    if(url.pathname==='/burn' || url.pathname==='/burn/'){res.writeHead(301,{Location:'/'});return res.end();}
    if(url.pathname==='/research'){res.writeHead(301,{Location:'/research/'});return res.end();}
    const path=resolve(root,'.'+decodeURIComponent(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
    if(!path.startsWith(root))return send(res,403,{error:'Forbidden.'});
    const contents=await readFile(path);
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'})[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff','Content-Security-Policy':CSP});res.end(contents);
  }catch(error){send(res,error.code==='ENOENT'?404:error instanceof URIError?400:500,{error:error.code==='ENOENT'?'Not found.':error instanceof URIError?'Bad address.':'Unable to process request.'});}
};}
// HOST=0.0.0.0 is for a hosted container (e.g. Render); on a laptop the server stays on loopback.
if(process.argv[1]===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT || 3000),process.env.HOST || '127.0.0.1',()=>{const base=`http://127.0.0.1:${process.env.PORT || 3000}`;console.log(`Will It Burn?: ${base}/\nFlameScope:    ${base}/research/`);});
