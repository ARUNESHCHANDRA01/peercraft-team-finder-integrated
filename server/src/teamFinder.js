// Everything about "find teammates" that is NOT Express and NOT Dify:
//   1. check what the website sent us            (validateRequest)
//   2. pick the best candidates to show the AI   (shortlistCandidates)
//   3. turn them into text for Dify              (formatProfiles)
//   4. check the AI's answer against real data   (interpretDifyResult)
//   5. glue it all together                      (handleTeamFinder)
//
// This file imports nothing, so it is easy to test: `npm test` in /server.

const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const PROFICIENCIES = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export const LIMITS = {
  MIN_MESSAGE: 15, // "hi" is not a project idea: reject it before spending AI money
  MAX_MESSAGE: 1500,
  MAX_CANDIDATES_RECEIVED: 200,
  MAX_CANDIDATES_SENT: 20, // how many profiles the AI gets to see
  MAX_PROFILES_CHARS: 8000, // keep in step with the PROFILES field limit in the Dify workflow
  MAX_SKILLS_PER_STUDENT: 20,
  MAX_INTERESTS_PER_STUDENT: 10,
  MAX_RESULTS: 5,
};

// ---------------------------------------------------------------- small helpers

/** Make text safe to put in a prompt: no control characters, no line breaks, limited length. */
export function clean(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const words = (text) => text.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);

// Different spellings of the same skill.
const ALIASES = {
  reactjs: 'react',
  nodejs: 'node',
  expressjs: 'express',
  vuejs: 'vue',
  nextjs: 'next',
  js: 'javascript',
  ts: 'typescript',
  html5: 'html',
  css3: 'css',
  mongo: 'mongodb',
  postgres: 'postgresql',
  ml: 'machinelearning',
};

export function skillKey(name) {
  const key = String(name).toLowerCase().replace(/[^a-z0-9+#]+/g, '');
  return ALIASES[key] ?? key;
}

/**
 * Does a student's skill (`owned`) cover a required skill?
 *   "ReactJS" covers "React"      (same skill, different spelling)
 *   "UI/UX Design" covers "UI/UX" (the student's skill is more specific)
 *   "JavaScript" does NOT cover "Java"
 */
export function skillMatches(required, owned) {
  if (skillKey(required) === skillKey(owned)) return true;
  const need = words(required);
  const have = words(owned);
  return need.length > 0 && need.every((token) => have.includes(token));
}

const fail = (code, message) => ({ ok: false, error: { code, message } });

// ---------------------------------------------------------------- 1. validate

function sanitizeCandidate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null;

  const fullName = clean(raw.fullName, 80);
  if (!fullName) return null;

  const skills = (Array.isArray(raw.skills) ? raw.skills : [])
    .slice(0, LIMITS.MAX_SKILLS_PER_STUDENT)
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const name = clean(s.name, 40);
      if (!name) return null;
      return {
        name,
        proficiency: PROFICIENCIES.includes(s.proficiency) ? s.proficiency : undefined,
        verified: s.verified === true,
      };
    })
    .filter(Boolean);
  if (skills.length === 0) return null; // nothing to match on

  const interests = (Array.isArray(raw.interests) ? raw.interests : [])
    .map((i) => clean(i, 40))
    .filter(Boolean)
    .slice(0, LIMITS.MAX_INTERESTS_PER_STUDENT);

  const reputation =
    typeof raw.reputation === 'number' && Number.isFinite(raw.reputation) && raw.reputation >= 0 && raw.reputation <= 5
      ? raw.reputation
      : undefined;

  // Only these fields survive. Emails, links and bios are never copied.
  return {
    id: raw.id,
    fullName,
    branch: clean(raw.branch, 80),
    academicYear: clean(raw.academicYear, 40),
    reputation,
    skills,
    interests,
  };
}

export function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('BAD_REQUEST', 'The request must be a JSON object.');
  }
  if (typeof body.message !== 'string') {
    return fail('BAD_REQUEST', 'Please describe your project.');
  }
  const message = clean(body.message, Infinity);
  if (message.length < LIMITS.MIN_MESSAGE) {
    return fail(
      'MESSAGE_TOO_SHORT',
      `Please describe your project in a bit more detail (at least ${LIMITS.MIN_MESSAGE} characters).`,
    );
  }
  if (message.length > LIMITS.MAX_MESSAGE) {
    return fail('MESSAGE_TOO_LONG', `Please keep the description under ${LIMITS.MAX_MESSAGE} characters.`);
  }

  if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
    return fail('NO_CANDIDATES', 'There are no students to search yet.');
  }
  if (body.candidates.length > LIMITS.MAX_CANDIDATES_RECEIVED) {
    return fail('TOO_MANY_CANDIDATES', 'Too many students were sent in one request.');
  }

  const seen = new Set();
  const candidates = [];
  for (const raw of body.candidates) {
    const candidate = sanitizeCandidate(raw);
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    candidates.push(candidate);
  }
  if (candidates.length === 0) {
    return fail('NO_CANDIDATES', 'None of the student profiles could be used.');
  }
  return { ok: true, value: { message, candidates } };
}

// ---------------------------------------------------------------- 2. shortlist

/**
 * A cheap, free first pass: students whose skills or interests are mentioned in the
 * message come first. The AI then ranks and explains the shortlist.
 */
export function shortlistCandidates(message, candidates, max = LIMITS.MAX_CANDIDATES_SENT) {
  const messageWords = words(message);
  const wordSet = new Set(messageWords);
  const phrase = ` ${messageWords.join(' ')} `;

  const scoreOf = (candidate) => {
    let score = 0;
    for (const skill of candidate.skills) {
      const w = words(skill.name);
      if (w.length === 0) continue;
      if (phrase.includes(` ${w.join(' ')} `)) score += 3;
      else if (w.some((token) => token.length >= 3 && wordSet.has(token))) score += 1;
    }
    for (const interest of candidate.interests) {
      const w = words(interest);
      if (w.length > 0 && phrase.includes(` ${w.join(' ')} `)) score += 1;
    }
    return score;
  };

  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreOf(candidate) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.candidate.reputation ?? 0) - (a.candidate.reputation ?? 0) ||
        a.index - b.index,
    )
    .slice(0, max)
    .map((entry) => entry.candidate);
}

// ---------------------------------------------------------------- 3. format

function profileBlock(c) {
  const skills = c.skills
    .map((s) => {
      const notes = [s.proficiency, s.verified ? 'verified' : null].filter(Boolean).join(', ');
      return notes ? `${s.name} (${notes})` : s.name;
    })
    .join(', ');
  return [
    `ID: ${c.id}`,
    `Name: ${c.fullName}`,
    c.branch && `Branch: ${c.branch}`,
    c.academicYear && `Year: ${c.academicYear}`,
    `Skills: ${skills}`,
    c.interests.length > 0 && `Interests: ${c.interests.join(', ')}`,
    c.reputation !== undefined && `Reputation: ${c.reputation} / 5`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * One text block per student, separated by "---". Stops adding students when the text would
 * get too long. `included` is exactly the list of students the AI is allowed to mention.
 */
export function formatProfiles(candidates, maxChars = LIMITS.MAX_PROFILES_CHARS) {
  const SEPARATOR = '\n---\n';
  const included = [];
  const blocks = [];
  let total = 0;
  for (const candidate of candidates) {
    const block = profileBlock(candidate);
    const added = block.length + (blocks.length > 0 ? SEPARATOR.length : 0);
    if (total + added > maxChars) break;
    blocks.push(block);
    included.push(candidate);
    total += added;
  }
  return { text: blocks.join(SEPARATOR), included };
}

// ---------------------------------------------------------------- 4. check the answer

/**
 * Dify's answer is a JSON string. We do NOT trust it blindly:
 *  - a student must be one we really sent (matching ID and name) or they are dropped
 *  - matched skills and scores are recomputed from the real profile, not from the AI's claim
 * The AI chooses candidates and writes the "reason"; the facts come from our own data.
 */
export function interpretDifyResult(resultText, included) {
  let data;
  try {
    data = JSON.parse(resultText);
  } catch {
    return { kind: 'bad_output' };
  }
  if (!data || typeof data !== 'object' || data.status === 'error') return { kind: 'bad_output' };

  if (data.status === 'needs_project_description') {
    return {
      kind: 'ok',
      body: { status: 'needs_project_description', requiredSkills: [], missingSkills: [], matches: [] },
    };
  }

  const required = (Array.isArray(data.required_skills) ? data.required_skills : [])
    .map((s) => clean(s, 40))
    .filter(Boolean)
    .slice(0, 12);

  const byId = new Map(included.map((c) => [c.id, c]));
  const seen = new Set();
  const matches = [];

  for (const item of Array.isArray(data.matches) ? data.matches : []) {
    if (!item || typeof item !== 'object') continue;
    const student = byId.get(item.student_id);
    if (!student || seen.has(student.id)) continue;
    if (clean(item.student_name, 80).toLowerCase() !== student.fullName.toLowerCase()) continue;

    const matchedSkills = required.filter((req) => student.skills.some((s) => skillMatches(req, s.name)));
    if (matchedSkills.length === 0) continue;

    seen.add(student.id);
    matches.push({
      studentId: student.id,
      fullName: student.fullName,
      branch: student.branch,
      academicYear: student.academicYear,
      reputation: student.reputation,
      matchScore: Math.round((matchedSkills.length / required.length) * 1000) / 10,
      matchedSkills,
      allSkills: student.skills.map((s) => s.name),
      reason: clean(item.reason, 200),
    });
  }

  matches.sort(
    (a, b) =>
      b.matchScore - a.matchScore ||
      b.matchedSkills.length - a.matchedSkills.length ||
      (b.reputation ?? 0) - (a.reputation ?? 0),
  );
  const top = matches.slice(0, LIMITS.MAX_RESULTS);
  const missingSkills = required.filter((req) => !top.some((m) => m.matchedSkills.includes(req)));

  return {
    kind: 'ok',
    body: {
      status: top.length > 0 ? 'ok' : 'no_matches',
      requiredSkills: required,
      missingSkills,
      matches: top,
    },
  };
}

// ---------------------------------------------------------------- 5. the whole request

const reply = (status, body) => ({ status, body });
const errorReply = (status, code, message) => reply(status, { error: { code, message } });

/**
 * @param body    what the website sent (already parsed JSON)
 * @param options { difyRun, userId, log }  difyRun is undefined when the server has no Dify key
 * @returns       { status, body } for Express to send back
 */
export async function handleTeamFinder(body, { difyRun, userId, log = () => {} } = {}) {
  if (typeof difyRun !== 'function') {
    return errorReply(503, 'NOT_CONFIGURED', 'The AI service is not set up on the server yet.');
  }

  const checked = validateRequest(body);
  if (!checked.ok) return errorReply(400, checked.error.code, checked.error.message);

  const { message, candidates } = checked.value;
  const { text, included } = formatProfiles(shortlistCandidates(message, candidates));
  if (included.length === 0) return errorReply(400, 'NO_CANDIDATES', 'None of the student profiles could be used.');

  let outcome;
  try {
    outcome = await difyRun({ AI_TEAM_FINDER: message, PROFILES: text }, userId);
  } catch (err) {
    // Details go to the server log only. The browser gets a short, safe message.
    log('error', { event: 'dify_failed', kind: err?.kind ?? 'unknown', status: err?.status, detail: err?.detail });
    if (err?.kind === 'timeout') {
      return errorReply(504, 'AI_TIMEOUT', 'The AI took too long to answer. Please try again.');
    }
    if (err?.kind === 'rate_limited') {
      return errorReply(429, 'AI_BUSY', 'The AI service is busy right now. Please try again in a minute.');
    }
    return errorReply(502, 'AI_UNAVAILABLE', 'The AI service could not complete the request. Please try again later.');
  }

  const interpreted = interpretDifyResult(outcome.result, included);
  if (interpreted.kind === 'bad_output') {
    log('error', { event: 'dify_bad_output' });
    return errorReply(502, 'AI_BAD_OUTPUT', 'The AI returned an answer we could not read. Please try again.');
  }
  return reply(200, interpreted.body);
}
