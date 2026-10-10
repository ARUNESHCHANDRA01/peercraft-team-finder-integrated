// The ONLY file that talks to Dify, and the only place the Dify API key is used.
// The key comes from server/.env, so it never reaches the browser.
//
// Dify docs: POST {base}/workflows/run  with  Authorization: Bearer <key>
//   body:     { inputs: {...}, response_mode: "blocking", user: "<who is asking>" }
//   response: { data: { status: "succeeded" | "failed" | ..., outputs: {...}, error } }

export class DifyError extends Error {
  /**
   * kind: 'auth' | 'rate_limited' | 'bad_request' | 'http' | 'network' | 'timeout'
   *       | 'workflow_failed' | 'bad_output'
   */
  constructor(kind, { status, detail } = {}) {
    super(`Dify call failed: ${kind}`);
    this.name = 'DifyError';
    this.kind = kind;
    this.status = status;
    this.detail = detail; // short text for the server log; never sent to the browser
  }
}

const snippet = (text) => String(text ?? '').replace(/\s+/g, ' ').slice(0, 300);

/**
 * @returns an async function  runWorkflow(inputs, userId) -> { result, elapsedSeconds }
 */
export function createDifyClient({ baseUrl, apiKey, timeoutMs = 90_000, fetchImpl = globalThis.fetch }) {
  const root = String(baseUrl).replace(/\/+$/, '');

  return async function runWorkflow(inputs, userId) {
    const controller = new AbortController();
    // Dify blocking calls are cut off at about 100 seconds, so stop a little earlier.
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response;
      try {
        response = await fetchImpl(`${root}/workflows/run`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs, response_mode: 'blocking', user: userId }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err?.name === 'AbortError') throw new DifyError('timeout');
        throw new DifyError('network', { detail: snippet(err?.message) });
      }

      if (!response.ok) {
        const detail = snippet(await response.text().catch(() => ''));
        if (response.status === 401 || response.status === 403) throw new DifyError('auth', { status: response.status, detail });
        if (response.status === 429) throw new DifyError('rate_limited', { status: response.status, detail });
        if (response.status === 400) throw new DifyError('bad_request', { status: response.status, detail });
        throw new DifyError('http', { status: response.status, detail });
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new DifyError('bad_output', { detail: 'response was not JSON' });
      }

      const data = payload?.data;
      if (!data || data.status !== 'succeeded') {
        throw new DifyError('workflow_failed', { detail: snippet(data?.error ?? `status ${data?.status}`) });
      }
      const result = data.outputs?.result;
      if (typeof result !== 'string') {
        throw new DifyError('bad_output', { detail: 'outputs.result missing' });
      }
      return { result, elapsedSeconds: data.elapsed_time };
    } finally {
      clearTimeout(timer);
    }
  };
}
