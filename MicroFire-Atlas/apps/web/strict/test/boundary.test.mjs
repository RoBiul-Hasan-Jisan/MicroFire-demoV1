import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { handle, TOOLS } from '../src/agents/mcp-server.mjs';
import { validateSelection } from '../src/agents/evidence-selector.mjs';
import { records } from '../src/compute/evidence.mjs';

const dir = new URL('../src/compute/', import.meta.url);

test('src/compute stays deterministic: no network, LLM, env or clock-driven imports', () => {
  for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs'))) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    assert.doesNotMatch(src, /\bfetch\(|node:https?|openai|anthropic|\.\.\/agents\/|\.\.\/acquire\/|process\.env|Math\.random/i, file);
  }
});

test('offline fixture exists for every acquire module the demo needs', () => {
  const fixture = JSON.parse(readFileSync(new URL('../demo_fixtures/ntrs-20210011385.json', import.meta.url), 'utf8'));
  assert.match(fixture.title, /BASS-II/);
});

test('agent selection cannot cite rows outside the offered evidence', () => {
  const items = records.slice(0, 3);
  assert.deepEqual(validateSelection({ ids: ['M1', 'M1'], abstain: false }, items), { abstain: false, ids: ['M1'] });
  assert.deepEqual(validateSelection({ ids: ['M2'], abstain: true }, items), { abstain: true, ids: [] });
  assert.throws(() => validateSelection({ ids: ['M20'], abstain: false }, items));
  assert.throws(() => validateSelection({ ids: 'M1', abstain: false }, items));
});

test('MCP server lists tools and answers from compute', async () => {
  const init = await handle({ id: 1, method: 'initialize', params: {} });
  assert.equal(init.serverInfo.name, 'flamescope');
  const { tools } = await handle({ id: 2, method: 'tools/list' });
  assert.deepEqual(tools.map(t => t.name), TOOLS.map(t => t.name));
  assert.ok(tools.every(t => t.inputSchema && !('run' in t)));
  const iss = await handle({ id: 3, method: 'tools/call', params: { name: 'will_it_burn', arguments: { q: 'Will acrylic burn on the ISS?' } } });
  assert.equal(iss.structuredContent.verdict.state, 'burned');
  const moon = await handle({ id: 4, method: 'tools/call', params: { name: 'will_it_burn', arguments: { mission: 'moon' } } });
  assert.equal(moon.structuredContent.verdict.state, 'no-data');
  // One test ID breaks the schema's minItems, so it is a protocol error (-32602), not a tool result.
  await assert.rejects(handle({ id: 5, method: 'tools/call', params: { name: 'compare_tests', arguments: { ids: ['M7'] } } }), e => e.code === -32602);
  await assert.rejects(handle({ id: 6, method: 'tools/call', params: { name: 'nope' } }));
  assert.equal(await handle({ method: 'notifications/initialized' }), undefined);
});

test('model calls cross one documented boundary, and public-data fetches cross another', () => {
  const agents = new URL('../src/agents/', import.meta.url), acquire = new URL('../src/acquire/', import.meta.url);
  for (const file of readdirSync(agents).filter(f => f.endsWith('.mjs'))) {
    const src = readFileSync(new URL(file, agents), 'utf8');
    if (file === 'provider.mjs') { assert.doesNotMatch(src, /from '\.\.\/acquire\/safe\.mjs'|writeFileSync|mkdirSync|node:fs/, 'the provider boundary never caches'); continue; }
    assert.doesNotMatch(src, /\bfetch\(/, `${file} must reach a model only through provider.mjs`);
  }
  for (const file of readdirSync(acquire).filter(f => f.endsWith('.mjs')))
    assert.doesNotMatch(readFileSync(new URL(file, acquire), 'utf8'), /OPENAI|api\.openai\.com/, `${file} must never carry model credentials`);
});
