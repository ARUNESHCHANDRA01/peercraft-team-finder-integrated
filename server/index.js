// Start the server:  npm start   (run it inside the /server folder)

import 'dotenv/config'; // reads server/.env into process.env
import { createApp } from './src/app.js';
import { createDifyClient } from './src/difyClient.js';

const PORT = Number(process.env.PORT) || 3001;
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const apiKey = process.env.DIFY_API_KEY?.trim();
const baseUrl = process.env.DIFY_API_BASE_URL?.trim();

let difyRun;
if (apiKey && baseUrl) {
  try {
    new URL(baseUrl); // fails early if the URL is mistyped
    difyRun = createDifyClient({ baseUrl, apiKey });
  } catch {
    console.warn('DIFY_API_BASE_URL is not a valid URL. Team Finder is switched off.');
  }
} else {
  console.warn('DIFY_API_KEY or DIFY_API_BASE_URL is missing in server/.env. Team Finder is switched off.');
}

const app = createApp({
  difyRun,
  allowedOrigins,
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE) || 6,
});

app.listen(PORT, () => {
  console.log(`PeerCraft server listening on http://localhost:${PORT}`);
  console.log(`Team Finder AI: ${difyRun ? 'configured' : 'NOT configured'}`);
});
