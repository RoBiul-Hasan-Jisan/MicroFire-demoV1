// FlameScope MCP server (stdio, newline-delimited JSON-RPC 2.0, no dependencies).
// Exposes the deterministic src/compute functions as tools, so any MCP client — Claude Code,
// Claude Desktop, an orchestrator — can query the evidence without being able to invent it.
// Every tool result is computed, never generated. Register with .mcp.json at the repo root.
// Arguments are checked against each tool's advertised schema before the tool runs.
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { records, provenance, search, comparison, makeBrief } from '../compute/evidence.mjs';
import { ask, InputError, MISSIONS, MATERIALS } from '../compute/scenario.mjs';
import { reportCitation } from '../acquire/ntrs.mjs';

// Newest first. The server answers with the client's version when it supports it, otherwise its own newest.
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const INSTRUCTIONS = 'Numbers come from NASA tables: the BASS-II report NASA/TM-20210011385 (Tables 5.1, 7.1, A.2 and 2.1) and NASA PSI files. will_it_burn answers burned, mixed, no-burn (no flame held), no-data or unresolved, and a test counts only if its own row records every condition given. Quote the tool output. Never extrapolate beyond it, and never present it as a safety rating.';

const ids = records.map(r => r.id);
const asStrings = args => Object.fromEntries(Object.entries(args).map(([k, v]) => [k, String(v)]));
const numberOr = (word, min, max, description) => ({ anyOf: [{ type: 'number', minimum: min, maximum: max }, { type: 'string', enum: [word] }], description });

export const TOOLS = [
  { name: 'will_it_burn',
    description: 'Check a spacecraft cabin scenario against NASA’s BASS-II microgravity tests (acrylic sheets, SIBAL fabric, Nomex). A test counts only if its own row records every condition given, together; nothing is interpolated. Returns a verdict state (burned, mixed, no-burn, no-data or unresolved), each condition’s check, the matching source rows or the closest tests, and sourced gaps. Never returns a safety rating.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      q: { type: 'string', maxLength: 500, description: 'Plain-English question, e.g. "Will it burn on a Moon base at 34% oxygen?"' },
      mission: { type: 'string', enum: [...MISSIONS.map(m => m.id), 'earth', 'other'] },
      place: { type: 'string', maxLength: 30, description: 'Name of the place when mission is "other"' },
      g: { type: 'number', minimum: 0, maximum: 10, description: 'Gravity in g when mission is "other"' },
      air: { type: 'string', enum: ['earth', 'exploration'] },
      o2: { type: 'number', minimum: 0, maximum: 100, description: 'Oxygen share, vol %' },
      psi: { type: 'number', minimum: 0, maximum: 1000, description: 'Cabin pressure, psi' },
      material: { type: 'string', enum: [...MATERIALS.map(m => m.id), 'other'] },
      materialName: { type: 'string', maxLength: 40, description: 'Name of the material when material is "other"' },
      thickness: numberOr('all', 0.001, 1000, 'Sheet thickness in mm, or "all"'),
      width: numberOr('all', 0.1, 10000, 'Sample width in mm, or "all"'),
      airflow: numberOr('none', 0, 100000, 'Airflow in cm/s (0 is still air), or "none" for any tested') } },
    run: args => ask(args) },
  { name: 'search_evidence',
    description: 'Search the 20 BASS-II acrylic (PMMA) sheet tests by question text, test ID, thickness or initial-oxygen range. Abstains on unsupported questions (safety ratings, other materials, other environments).',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      question: { type: 'string', maxLength: 2000 }, thickness: { type: 'number', minimum: 0, maximum: 1000 },
      oxygenMin: { type: 'number', minimum: 0, maximum: 100 }, oxygenMax: { type: 'number', minimum: 0, maximum: 100 } } },
    run: args => search(asStrings(args)) },
  { name: 'compare_tests',
    description: 'Descriptive comparison of 2–3 tests: which conditions differ and why the comparison is not causal.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['ids'], properties: {
      ids: { type: 'array', items: { type: 'string', enum: ids }, minItems: 2, maxItems: 3, uniqueItems: true } } },
    run: ({ ids: want }) => ({ records: records.filter(r => want.includes(r.id)), ...comparison(records.filter(r => want.includes(r.id))) }) },
  { name: 'evidence_brief',
    description: 'Build a source-linked evidence brief (published measurements, conditions, gaps) or an abstention for a question over chosen tests.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['question', 'ids'], properties: {
      question: { type: 'string', maxLength: 2000 },
      ids: { type: 'array', items: { type: 'string', enum: ids }, minItems: 1, maxItems: 20 } } },
    run: ({ question, ids: want }) => makeBrief(question, records.filter(r => want.includes(r.id))) },
  { name: 'get_provenance',
    description: 'Where the acrylic rows came from: report, table, page, transcription method, verification status and limitations, plus whether the NTRS citation record came live, from the cache or from the committed fixture.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    run: async () => ({ ...provenance, citation: await reportCitation().catch(e => ({ error: e.message })) }) }
];

class SchemaError extends Error {}
const kind = v => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;

/** Checks a value against the subset of JSON Schema these tools use. Throws a SchemaError naming the problem. */
export function validate(value, schema, at = 'arguments') {
  if (schema.anyOf) {
    if (schema.anyOf.some(s => { try { validate(value, s, at); return true; } catch { return false; } })) return;
    throw new SchemaError(`${at} has an unsupported value.`);
  }
  if (schema.type === 'number' ? typeof value !== 'number' || !Number.isFinite(value) : schema.type && kind(value) !== schema.type)
    throw new SchemaError(`${at} must be ${schema.type === 'array' || schema.type === 'object' ? 'an' : 'a'} ${schema.type}.`);
  if (schema.enum && !schema.enum.includes(value)) throw new SchemaError(`${at} must be one of: ${schema.enum.join(', ')}.`);
  if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)))
    throw new SchemaError(`${at} must be from ${schema.minimum} to ${schema.maximum}.`);
  if (typeof value === 'string' && schema.maxLength !== undefined && value.length > schema.maxLength) throw new SchemaError(`${at} is longer than ${schema.maxLength} characters.`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new SchemaError(`${at} needs at least ${schema.minItems} items.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new SchemaError(`${at} takes at most ${schema.maxItems} items.`);
    if (schema.uniqueItems && new Set(value).size !== value.length) throw new SchemaError(`${at} repeats an item.`);
    if (schema.items) value.forEach((v, i) => validate(v, schema.items, `${at}[${i}]`));
  }
  if (kind(value) === 'object') {
    for (const k of schema.required || []) if (!(k in value)) throw new SchemaError(`${at}.${k} is required.`);
    for (const [k, v] of Object.entries(value)) {
      if (!schema.properties?.[k]) { if (schema.additionalProperties === false) throw new SchemaError(`${at} has an unknown field: ${String(k).slice(0, 40)}.`); }
      else validate(v, schema.properties[k], `${at}.${k}`);
    }
  }
}

const rpcError = (code, message) => Object.assign(Error(message), { code });

export async function handle(msg) {
  if (kind(msg) !== 'object' || typeof msg.method !== 'string') throw rpcError(-32600, 'Invalid Request');
  const { id, method } = msg, params = msg.params ?? {};
  if (method === 'initialize') return {
    protocolVersion: PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
    capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'flamescope', version: '1.1.0' }, instructions: INSTRUCTIONS };
  if (method === 'tools/list') return { tools: TOOLS.map(({ run, ...t }) => t) };
  if (method === 'tools/call') {
    if (kind(params) !== 'object') throw rpcError(-32602, 'Invalid params');
    const tool = TOOLS.find(t => t.name === params.name);
    if (!tool) throw rpcError(-32602, `Unknown tool: ${String(params.name).slice(0, 60)}`);
    const args = params.arguments ?? {};
    try { validate(args, tool.inputSchema); } catch (e) { throw rpcError(-32602, `Invalid arguments: ${e.message}`); }
    try { const out = await tool.run(args);
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out }; }
    catch (e) { return { content: [{ type: 'text', text: e instanceof InputError ? e.message : 'Tool failed.' }], isError: true }; }
  }
  if (method === 'ping') return {};
  if (id === undefined) return undefined; // notifications, e.g. notifications/initialized
  throw rpcError(-32601, `Method not found: ${method.slice(0, 60)}`);
}

// One line in, at most one line out. A bad line gets an error reply and never stops the process.
export async function respond(line) {
  if (!line.trim()) return null;
  let msg;
  try { msg = JSON.parse(line); } catch { return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }; }
  const isObject = kind(msg) === 'object', notification = isObject && msg.id === undefined;
  const id = isObject && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null;
  try {
    const result = await handle(msg);
    return notification || result === undefined ? null : { jsonrpc: '2.0', id, result };
  } catch (e) {
    return notification ? null : { jsonrpc: '2.0', id, error: { code: e.code || -32603, message: e.code ? e.message : 'Internal error' } };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Lines are handled one at a time, so replies come back in the order the requests arrived.
  let queue = Promise.resolve();
  createInterface({ input: process.stdin }).on('line', line => {
    queue = queue.then(() => respond(line)).then(reply => { if (reply) process.stdout.write(JSON.stringify(reply) + '\n'); });
  });
}
