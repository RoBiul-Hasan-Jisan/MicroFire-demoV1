// The wrapper every public-data fetch goes through (Node port of the brief's safe.py).
// Live first, cache second, committed fixture last. Returns { data, source } where
// source is 'live' | 'cache' | 'fixture' — show it in the UI as a badge.
// OFFLINE=1 skips the network entirely. fetchJson parses JSON; fetchText keeps the body
// as text (CSV files, for example), stored in the cache and fixture as a JSON string.
// A corrupt cache or fixture file is skipped, never trusted, so the next copy still gets its turn.
// Authenticated model calls never come through here; they use src/agents/provider.mjs (ADR-013).
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
export const CACHE = fileURLToPath(new URL('cache/', ROOT));
export const FIXTURES = fileURLToPath(new URL('demo_fixtures/', ROOT));

export const keyFor = (url, params = {}) =>
  createHash('md5').update(url + JSON.stringify(Object.entries(params).sort())).digest('hex');

export const fetchJson = (url, options) => fetchSafe(url, options, r => r.json());
// Pass `encoding` for files that aren't UTF-8 (some NASA CSVs are Windows-1252).
export const fetchText = (url, { encoding = 'utf-8', ...options } = {}) =>
  fetchSafe(url, options, async r => new TextDecoder(encoding).decode(await r.arrayBuffer()));

function readJson(file) {
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

async function fetchSafe(url, { params = {}, name = null, timeout = 25000, headers = {}, cacheDir = CACHE, fixtureDir = FIXTURES } = {}, read) {
  const key = name || keyFor(url, params);
  const cached = join(cacheDir, `${key}.json`), fixture = join(fixtureDir, `${key}.json`);

  if (process.env.OFFLINE !== '1') {
    try {
      const target = new URL(url);
      for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
      const r = await fetch(target, { headers, signal: AbortSignal.timeout(timeout) });
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      const data = await read(r);
      try { mkdirSync(cacheDir, { recursive: true }); writeFileSync(cached, JSON.stringify(data)); } catch { /* a read-only disk still gets the live data */ }
      return { data, source: 'live' };
    } catch { /* fall through to cache, then fixture */ }
  }
  const fromCache = readJson(cached);
  if (fromCache !== undefined) return { data: fromCache, source: 'cache' };
  const fromFixture = readJson(fixture);
  if (fromFixture !== undefined) return { data: fromFixture, source: 'fixture' };
  throw Error(`No usable live, cache or fixture data for ${key}`);
}
