import type { UserProfile } from '../types';

// This file is the website's only connection to the AI Team Finder.
// It talks to YOUR server (/api/team-finder). It never talks to Dify and it never holds a key.
// During development, vite.config.ts forwards /api to the server on port 3001.
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '');

// The AI can take a while (two AI calls), so give it a generous but finite time.
const REQUEST_TIMEOUT_MS = 100_000;

export interface TeamMatch {
  studentId: string;
  fullName: string;
  branch: string;
  academicYear: string;
  reputation?: number;
  matchScore: number; // 0-100, computed by the server from the real profile
  matchedSkills: string[];
  allSkills: string[];
  reason: string;
}

export interface TeamFinderResult {
  status: 'ok' | 'no_matches' | 'needs_project_description';
  requiredSkills: string[];
  missingSkills: string[];
  matches: TeamMatch[];
}

/** An error whose message is safe and friendly enough to show to the student. */
export class TeamFinderError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TeamFinderError';
    this.code = code;
  }
}

/**
 * Only profile facts needed for matching are sent: no email, no links, no bio.
 * Private profiles and non-students (such as the admin) are never sent.
 */
export function buildCandidates(users: UserProfile[], currentUserId: string) {
  return users
    .filter((u) => u.role === 'student' && u.id !== currentUserId && u.profileVisibility !== 'private')
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      branch: u.branch,
      academicYear: u.academicYear,
      reputation: u.reputation,
      interests: u.interests,
      skills: u.skills.map((s) => ({ name: s.name, proficiency: s.proficiency, verified: s.verified })),
    }));
}

export async function findTeammates(
  message: string,
  users: UserProfile[],
  currentUserId: string,
): Promise<TeamFinderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/team-finder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, candidates: buildCandidates(users, currentUserId) }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TeamFinderError('TIMEOUT', 'The AI took too long to answer. Please try again.');
    }
    throw new TeamFinderError(
      'NETWORK',
      'I could not reach the PeerCraft server. Make sure it is running (npm start inside the server folder).',
    );
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Not JSON (for example the dev server is down and returned an HTML error page).
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new TeamFinderError(
      error?.code ?? 'SERVER_ERROR',
      error?.message ?? 'The Team Finder is not available right now. Please try again later.',
    );
  }

  const result = payload as Partial<TeamFinderResult> | null;
  if (!result || !Array.isArray(result.matches) || typeof result.status !== 'string') {
    throw new TeamFinderError('BAD_RESPONSE', 'The server sent an answer I could not read. Please try again.');
  }
  return {
    status: result.status,
    requiredSkills: result.requiredSkills ?? [],
    missingSkills: result.missingSkills ?? [],
    matches: result.matches,
  };
}

/** Turns a result into the plain-text message shown in the AI Mentor chat. */
export function formatTeamReply(result: TeamFinderResult): string {
  if (result.status === 'needs_project_description') {
    return (
      'Tell me a little more about the project you want to build: what it does and what kind of help you need. ' +
      "Then I'll look for teammates."
    );
  }

  const skills = result.requiredSkills.length > 0 ? `Skills this project needs: ${result.requiredSkills.join(', ')}\n\n` : '';

  if (result.status === 'no_matches' || result.matches.length === 0) {
    return (
      `${skills}I could not find students whose listed skills match this project yet. ` +
      'Try describing the project in a different way, or check the Team Finder page to browse everyone.'
    );
  }

  const lines = result.matches.map((m, index) => {
    const about = [m.branch, m.academicYear].filter(Boolean).join(' · ');
    return (
      `${index + 1}. ${m.fullName} (${m.matchScore}% match)` +
      (about ? `\n   ${about}` : '') +
      `\n   Matches: ${m.matchedSkills.join(', ')}` +
      (m.reason ? `\n   Why: ${m.reason}` : '')
    );
  });

  const missing =
    result.missingSkills.length > 0
      ? `\n\nStill missing on your team: ${result.missingSkills.join(', ')}`
      : '\n\nBetween them, these students cover every skill I found for this project.';

  return `${skills}Top matches:\n\n${lines.join('\n\n')}${missing}\n\nOpen the Team Finder page to view profiles and send invites.`;
}
