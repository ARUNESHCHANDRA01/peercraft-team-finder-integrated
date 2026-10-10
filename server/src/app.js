// The Express app: it only receives requests and sends answers.
// All the real logic lives in teamFinder.js, which is tested separately.

import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { handleTeamFinder } from './teamFinder.js';
import { createRateLimiter } from './rateLimit.js';

const defaultLog = (level, fields) => console.error(JSON.stringify({ level, time: new Date().toISOString(), ...fields }));

/**
 * @param difyRun         function that calls Dify, or undefined if no API key is configured
 * @param allowedOrigins  websites allowed to call this server, e.g. ['http://localhost:5173']
 */
export function createApp({ difyRun, allowedOrigins, rateLimitPerMinute = 6, log = defaultLog }) {
  const app = express();
  app.disable('x-powered-by');

  // Only your own website may call this server from a browser.
  app.use(cors({ origin: allowedOrigins }));
  // Students' profiles travel in the request body, so allow a bit more than the default.
  app.use(express.json({ limit: '300kb' }));

  const limiter = createRateLimiter({ windowMs: 60_000, max: rateLimitPerMinute });
  setInterval(limiter.sweep, 60_000).unref();

  // Open http://localhost:3001/api/health to check the server is alive.
  // It says whether Dify is configured, but never shows the key.
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'peercraft-server', difyConfigured: typeof difyRun === 'function' });
  });

  app.post('/api/team-finder', limiter.middleware, async (req, res) => {
    // Dify wants to know "who is asking". We give it an anonymous ID, never a name or email.
    const userId = 'peercraft-' + crypto.createHash('sha256').update(String(req.ip)).digest('hex').slice(0, 16);
    try {
      const { status, body } = await handleTeamFinder(req.body, { difyRun, userId, log });
      res.status(status).json(body);
    } catch (err) {
      log('error', { event: 'unhandled', message: String(err?.message ?? err).slice(0, 200) });
      res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } });
    }
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } });
  });

  // Catches problems like a request body that is not valid JSON.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'The request was too large.' } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'The request was not valid JSON.' } });
    }
    log('error', { event: 'express_error', message: String(err?.message ?? err).slice(0, 200) });
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } });
  });

  return app;
}
