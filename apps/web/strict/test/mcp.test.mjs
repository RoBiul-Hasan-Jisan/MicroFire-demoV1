import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handle, respond, validate, TOOLS, PROTOCOL_VERSIONS } from '../src/agents/mcp-server.mjs';

const SERVER = fileURLToPath(new URL('../src/agents/mcp-server.mjs', import.meta.url));

test('the stdio server answers bad lines with errors and keeps running', async () => {
  const env = { ...process.env, OFFLINE: '1' }; delete env.OPENAI_API_KEY;
  const child = spawn(process.execPath, [SERVER], { env, stdio: ['pipe', 'pipe', 'pipe'] });
  const replies = [];
  let buffer = '', stderr = '';
  child.stdout.on('data', d => { buffer += d; let i; while ((i = buffer.indexOf('\n')) >= 0) { replies.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); } });
  child.stderr.on('data', d => { stderr += d; });
  const until = n => new Promise((resolve, reject) => {
    const started = Date.now(), poll = setInterval(() => {
      if (replies.length >= n) { clearInterval(poll); resolve(); }
      else if (child.exitCode !== null || Date.now() - started > 5000) { clearInterval(poll); reject(new Error(`got ${replies.length} replies; exit ${child.exitCode}; ${stderr}`)); }
    }, 10);
  });
  try {
    for (const line of ['null', '[]', '{bad json', '42', '{"jsonrpc":"2.0","id":7,"method":"ping"}']) child.stdin.write(line + '\n');
    await until(5);
    assert.deepEqual(replies.slice(0, 4).map(r => [r.id, r.error.code]), [[null, -32600], [null, -32600], [null, -32700], [null, -32600]]);
    assert.deepEqual(replies[4], { jsonrpc: '2.0', id: 7, result: {} }, 'still answering after the bad lines');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'compare_tests', arguments: { ids: 'M1' } } }) + '\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'will_it_burn', arguments: { q: 'Will acrylic burn on the ISS?' } } }) + '\n');
    await until(7);
    assert.equal(replies[5].error.code, -32602); assert.match(replies[5].error.message, /ids must be an array/);
    assert.equal(replies[6].result.structuredContent.verdict.state, 'burned');
    assert.equal(child.exitCode, null, 'the process is still alive');
  } finally { child.kill(); }
});

test('arguments are checked against the advertised schema before a tool runs', async () => {
  const call = (name, args) => handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  for (const [name, args, message] of [
    ['compare_tests', { ids: ['M7'] }, /at least 2 items/], ['compare_tests', { ids: ['M7', 'M7'] }, /repeats an item/],
    ['compare_tests', { ids: ['M7', 'X9'] }, /must be one of/], ['will_it_burn', { o2: '21' }, /o2 must be a number/],
    ['will_it_burn', { o2: 101 }, /o2 must be from 0 to 100/], ['will_it_burn', { thickness: 'thick' }, /thickness has an unsupported value/],
    ['will_it_burn', { unexpected: true }, /unknown field: unexpected/], ['search_evidence', { thickness: '1' }, /thickness must be a number/],
    ['evidence_brief', { ids: ['M1'] }, /question is required/]
  ]) await assert.rejects(call(name, args), e => e.code === -32602 && message.test(e.message), `${name} ${JSON.stringify(args)}`);
  // A valid call whose answer is an input problem is a tool result with isError, not a protocol error.
  const r = await call('will_it_burn', { material: 'other' });
  assert.equal(r.isError, true); assert.match(r.content[0].text, /Unknown material/);
  assert.equal((await call('will_it_burn', { material: 'nomex', thickness: 'all', airflow: 'none' })).structuredContent.verdict.state, 'no-burn');
  await assert.rejects(call('nope', {}), e => e.code === -32602);
  assert.doesNotThrow(() => validate({ ids: ['M1', 'M2'] }, TOOLS.find(t => t.name === 'compare_tests').inputSchema));
});

test('protocol negotiation, descriptions and outcome states match what the server does', async () => {
  const init = v => handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v } });
  assert.equal((await init('2025-03-26')).protocolVersion, '2025-03-26', 'a supported version is kept');
  assert.equal((await init('1999-01-01')).protocolVersion, PROTOCOL_VERSIONS[0], 'an unknown version gets the newest supported one');
  const { instructions } = await init();
  assert.match(instructions, /burned, mixed, no-burn \(no flame held\), no-data or unresolved/);
  assert.doesNotMatch(instructions, /Every number comes from NASA\/TM-20210011385 Table 5\.1/);
  const will = TOOLS.find(t => t.name === 'will_it_burn');
  for (const state of ['burned', 'mixed', 'no-burn', 'no-data', 'unresolved']) assert.match(will.description, new RegExp(state));
  assert.ok(will.inputSchema.properties.material.enum.includes('sibal'), 'the material the API accepts is in the schema');
  assert.equal(await respond('{"jsonrpc":"2.0","method":"notifications/initialized"}'), null, 'notifications get no reply');
});
