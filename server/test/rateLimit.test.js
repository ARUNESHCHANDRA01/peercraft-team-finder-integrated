import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/rateLimit.js';

test('allows up to max requests per window, then blocks, then resets', () => {
  let time = 0;
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3, now: () => time });

  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('a').allowed, true);

  time = 10_000;
  const blocked = limiter.check('a');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 50);

  assert.equal(limiter.check('b').allowed, true); // other visitors are unaffected

  time = 60_000;
  assert.equal(limiter.check('a').allowed, true); // window ended
});

test('middleware answers 429 with a Retry-After header', () => {
  const limiter = createRateLimiter({ max: 1, now: () => 0 });
  const req = { ip: '1.2.3.4' };
  const sent = {};
  const res = {
    set: (name, value) => (sent.header = [name, value]),
    status: (code) => ((sent.status = code), res),
    json: (body) => (sent.body = body),
  };
  let nextCalls = 0;
  limiter.middleware(req, res, () => nextCalls++);
  limiter.middleware(req, res, () => nextCalls++);
  assert.equal(nextCalls, 1);
  assert.equal(sent.status, 429);
  assert.equal(sent.body.error.code, 'RATE_LIMITED');
  assert.equal(sent.header[0], 'Retry-After');
});

test('sweep removes finished windows', () => {
  let time = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => time });
  limiter.check('a');
  time = 5000;
  limiter.sweep();
  assert.equal(limiter.check('a').allowed, true);
});
