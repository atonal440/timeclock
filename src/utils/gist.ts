// Backup to a secret GitHub Gist. The gist is a mirror of this device's data:
// every change pushes `timeclock.journal` (hledger, for scripts) and
// `timeclock.json` (full app state, for restoring). Pulling merges the gist's
// entries into local data; it never deletes anything locally.

import type { Entry } from './timeclock';
import { exportTimeclock } from './timeclock';

export const JOURNAL_FILE = 'timeclock.journal';
export const JSON_FILE = 'timeclock.json';
const API = 'https://api.github.com';

export interface BackupState {
  entries: Entry[];
  projects: string[];
  hiddenProjects: string[];
}

export interface GistInfo {
  id: string;
  url: string;
}

export class GistError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

/** Accepts a bare gist ID or any gist.github.com URL. */
export function parseGistId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const m = t.match(/([0-9a-f]{20,})\/?(?:#.*)?$/i);
  return m ? m[1] : null;
}

export function backupFiles(state: BackupState): Record<string, string> {
  const json = {
    app: 'timeclock',
    version: 1,
    entries: state.entries,
    projects: state.projects,
    hiddenProjects: state.hiddenProjects,
  };
  return {
    [JOURNAL_FILE]: exportTimeclock(state.entries),
    [JSON_FILE]: JSON.stringify(json, null, 1) + '\n',
  };
}

export function parseBackupJson(text: string): BackupState {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.entries)) throw new GistError(`${JSON_FILE} has no entries.`);
  const entries: Entry[] = data.entries.filter((e: Entry) =>
    e && (e.type === 'i' || e.type === 'o') && typeof e.datetime === 'string' && !isNaN(Date.parse(e.datetime))
  );
  const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return { entries, projects: strings(data.projects), hiddenProjects: strings(data.hiddenProjects) };
}

async function request(token: string, method: string, path: string, body?: unknown, keepalive = false) {
  let res: Response;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      keepalive,
    });
  } catch {
    throw new GistError('Offline — will retry.');
  }
  if (res.ok) return res.json();
  if (res.status === 401) throw new GistError('Token rejected — check it or make a new one.', 401);
  if (res.status === 403 || res.status === 404) {
    throw new GistError(
      path === '/gists' ? "Token can't create gists — it needs Gists read & write." : "Gist not found, or the token can't access it.",
      res.status
    );
  }
  throw new GistError(`GitHub error ${res.status}.`, res.status);
}

const toGistFiles = (files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([name, content]) => [name, { content }]));

export async function createGist(token: string, files: Record<string, string>): Promise<GistInfo> {
  const g = await request(token, 'POST', '/gists', {
    description: 'TimeClock backup',
    public: false,
    files: toGistFiles(files),
  });
  return { id: g.id, url: g.html_url };
}

export async function updateGist(token: string, id: string, files: Record<string, string>, keepalive = false): Promise<void> {
  await request(token, 'PATCH', `/gists/${id}`, { files: toGistFiles(files) }, keepalive);
}

/** Fetch the gist's saved state, or null if it has no timeclock.json yet. */
export async function readGist(token: string, id: string): Promise<{ info: GistInfo; state: BackupState | null }> {
  const g = await request(token, 'GET', `/gists/${id}`);
  const info = { id: g.id, url: g.html_url };
  const file = g.files?.[JSON_FILE];
  if (!file) return { info, state: null };
  let content: string = file.content;
  if (file.truncated) {
    const res = await fetch(file.raw_url, { cache: 'no-store' });
    if (!res.ok) throw new GistError(`Couldn't download ${JSON_FILE}.`, res.status);
    content = await res.text();
  }
  return { info, state: parseBackupJson(content) };
}
