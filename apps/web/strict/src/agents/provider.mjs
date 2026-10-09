// The only way FlameScope reaches a language-model provider (ADR-013).
// Public NASA data goes through src/acquire/safe.mjs, which caches responses and falls back to fixtures.
// Authenticated model calls must never do that: a cached model reply would be stale, and a cache file could
// end up holding request context. So this boundary is separate and deliberately small:
//   - OFFLINE=1 or a missing key refuses the call before anything leaves the machine
//   - the key only ever travels in the Authorization header, and never appears in an error message
//   - nothing is written to disk, and every call has a timeout
// Tests replace `transport.fetch`, so no test ever makes a real (or billable) call.
export const transport = { fetch: (...args) => globalThis.fetch(...args) };

export const providerKey = () => process.env.OPENAI_API_KEY || '';
export const providerReady = () => process.env.OFFLINE !== '1' && !!providerKey();

export class ProviderError extends Error {}

/** POSTs one JSON request to the provider and returns the parsed JSON reply, or throws a ProviderError. */
export async function callProvider(url, body, { timeoutMs = 20000 } = {}) {
  if (process.env.OFFLINE === '1') throw new ProviderError('Offline mode: no model call was made.');
  if (!providerKey()) throw new ProviderError('No provider key is configured.');
  let response;
  try {
    response = await transport.fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerKey()}` },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new ProviderError(error?.name === 'TimeoutError' ? 'The provider timed out.' : 'The provider could not be reached.');
  }
  if (!response.ok) throw new ProviderError(`The provider answered HTTP ${response.status}.`);
  try { return await response.json(); } catch { throw new ProviderError('The provider sent something that isn’t JSON.'); }
}
