# PeerCraft server

A small Express server between the website and Dify (the AI workflow).

```
Website (React)  ->  this server  ->  Dify
 no secrets          holds the key     runs the AI Team Finder
```

The website can be read by anyone with browser tools, so it must never hold the Dify API key.
This server keeps the key in `server/.env`, which is never committed to GitHub.

## One-time setup

### 1. Import the workflow into Dify
1. In Dify choose **Create from DSL file** and import `dify/PEERCRAFT.team-finder.v4.yml`.
2. Open the app, click **Publish**.
3. Open **API Access** (in the app's left menu). Copy the **API Server** address and create an **API Key**.
   Keep the key private. Do not paste it into chat, code or GitHub.

The workflow needs your OpenAI model configured in Dify (it uses `gpt-5`). The old knowledge base is not
used any more: the website sends the student profiles with every request.

### 2. Configure the server
```bash
cd server
npm install
cp .env.example .env      # on Windows: copy .env.example .env
```
Open `server/.env` and fill in:
- `DIFY_API_BASE_URL` (from the API Access page, usually `https://api.dify.ai/v1`)
- `DIFY_API_KEY`

### 3. Run it
Terminal 1, inside `server/`:
```bash
npm start
```
Visit http://localhost:3001/api/health. You should see `"difyConfigured": true`.

Terminal 2, from the project root:
```bash
npm run dev
```
Open the site, click **AI Mentor**, switch to **Team** mode and describe a project.

## Check it without the website
```bash
curl -s http://localhost:3001/api/team-finder \
  -H "Content-Type: application/json" \
  -d '{"message":"I am building a campus event website with login and a clean design",
       "candidates":[{"id":"demo_1","fullName":"Demo Student","skills":[{"name":"React"},{"name":"CSS"}]}]}'
```

## Run the tests
```bash
cd server
npm test
```
The tests use fictional students and a fake local Dify server, so they need no key and no internet.

## What the server checks
- The message must be 15 to 1500 characters, and at most 200 students are accepted per request.
- Only name, branch, year, skills, interests and reputation are forwarded to the AI. Emails, links and bios never are.
- Every student the AI returns must be one we sent, with a matching ID and name. Matched skills and scores are
  recalculated from the real profile, so the AI cannot invent a student, a skill or a score.
- Errors sent to the browser are short and safe. Details go to the server log only.
- At most 6 requests per minute per visitor (`RATE_LIMIT_PER_MINUTE`), because each request makes paid AI calls.

## Known limits (good next steps)
- Student profiles currently live in the website's demo data, so the website sends them with each request.
  Once there is a real database (for example Supabase), the server should load profiles itself, so the
  browser can no longer send fake ones.
- Learn / Hint / Debug modes in the AI Mentor are still scripted demo replies. Only Team mode uses the AI.
