import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDifyClient, DifyError } from '../src/difyClient.js';

// A fake Dify server on a random local port, so these tests need no network and no real key.
async function withFakeDify(handler, run) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : null });
      handler(req, res, requests.at(-1));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1/`; // trailing slash on purpose
  try {
    await run({ baseUrl, requests });
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

test('sends the documented request and returns outputs.result', async () => {
  await withFakeDify(
    (req, res) => json(res, 200, { data: { status: 'succeeded', outputs: { result: '{"ok":true}' }, elapsed_time: 3.2 } }),
    async ({ baseUrl, requests }) => {
      const run = createDifyClient({ baseUrl, apiKey: 'app-test-key' });
      const out = await run({ AI_TEAM_FINDER: 'idea', PROFILES: 'profiles' }, 'peercraft-abc');
      assert.deepEqual(out, { result: '{"ok":true}', elapsedSeconds: 3.2 });

      const [request] = requests;
      assert.equal(request.method, 'POST');
      assert.equal(request.url, '/v1/workflows/run'); // no double slash
      assert.equal(request.headers.authorization, 'Bearer app-test-key');
      assert.deepEqual(request.body, {
        inputs: { AI_TEAM_FINDER: 'idea', PROFILES: 'profiles' },
        response_mode: 'blocking',
        user: 'peercraft-abc',
      });
    },
  );
});

test('maps HTTP errors to error kinds without exposing the key', async () => {
  const cases = [
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limited'],
    [400, 'bad_request'],
    [500, 'http'],
  ];
  for (const [status, kind] of cases) {
    await withFakeDify(
      (req, res) => json(res, status, { message: 'nope' }),
      async ({ baseUrl }) => {
        const run = createDifyClient({ baseUrl, apiKey: 'app-secret-key' });
        await assert.rejects(run({}, 'u'), (err) => {
          assert.ok(err instanceof DifyError);
          assert.equal(err.kind, kind);
          assert.equal(err.status, status);
          assert.equal(JSON.stringify([err.message, err.detail]).includes('app-secret-key'), false);
          return true;
        });
      },
    );
  }
});

test('a workflow that did not succeed is a workflow_failed error', async () => {
  await withFakeDify(
    (req, res) => json(res, 200, { data: { status: 'failed', error: 'LLM node crashed' } }),
    async ({ baseUrl }) => {
      const run = createDifyClient({ baseUrl, apiKey: 'k' });
      await assert.rejects(run({}, 'u'), (err) => err.kind === 'workflow_failed' && /LLM node crashed/.test(err.detail));
    },
  );
});

test('missing outputs.result or non-JSON replies are bad_output', async () => {
  await withFakeDify(
    (req, res) => json(res, 200, { data: { status: 'succeeded', outputs: {} } }),
    async ({ baseUrl }) => {
      await assert.rejects(createDifyClient({ baseUrl, apiKey: 'k' })({}, 'u'), (err) => err.kind === 'bad_output');
    },
  );
  await withFakeDify(
    (req, res) => { res.writeHead(200); res.end('<html>not json</html>'); },
    async ({ baseUrl }) => {
      await assert.rejects(createDifyClient({ baseUrl, apiKey: 'k' })({}, 'u'), (err) => err.kind === 'bad_output');
    },
  );
});

test('a slow Dify becomes a timeout error', async () => {
  await withFakeDify(
    () => { /* never answers */ },
    async ({ baseUrl }) => {
      const run = createDifyClient({ baseUrl, apiKey: 'k', timeoutMs: 100 });
      await assert.rejects(run({}, 'u'), (err) => err.kind === 'timeout');
    },
  );
});

test('an unreachable Dify becomes a network error', async () => {
  const run = createDifyClient({ baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k' });
  await assert.rejects(run({}, 'u'), (err) => err.kind === 'network');
});
