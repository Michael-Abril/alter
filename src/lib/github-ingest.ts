/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GitHub activity ingestion — fetches commits, PRs, issues from GitHub REST API
 * DEPENDENCIES: @/lib/github (loadGitHubConfig)
 * STATUS: LIVE — powers GitHub activity sync for briefings
 */

import { loadGitHubConfig, type GitHubConfig } from '@/lib/github';

const GITHUB_API = 'https://api.github.com';

interface GitHubHeaders {
  [key: string]: string;
  Authorization: string;
  Accept: string;
  'User-Agent': string;
}

function buildHeaders(token: string): GitHubHeaders {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Alter-AI',
  };
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface PRInfo {
  number: number;
  title: string;
  body: string | null;
  url: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueInfo {
  number: number;
  title: string;
  body: string | null;
  url: string;
  labels: string[];
  createdAt: string;
}

export interface ActivityItem {
  type: 'commit' | 'pr' | 'issue';
  title: string;
  body: string | null;
  url: string;
  githubId: string;
  authoredAt: string;
}

function loadConfigOrNull(userId: string): GitHubConfig | null {
  const config = loadGitHubConfig(userId);
  if (!config || !config.token) return null;
  return config;
}

/**
 * Fetch recent commits from the default repo within the last N days.
 */
export async function fetchRecentCommits(
  userId: string,
  daysBack: number = 3
): Promise<CommitInfo[]> {
  const config = loadConfigOrNull(userId);
  if (!config) return [];

  try {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const sinceISO = since.toISOString();

    const url = `${GITHUB_API}/repos/${config.defaultOwner}/${config.defaultRepo}/commits?since=${sinceISO}&per_page=30`;
    const res = await fetch(url, { headers: buildHeaders(config.token) });

    if (!res.ok) {
      console.warn(`[github-ingest] Commits fetch failed (${res.status})`);
      return [];
    }

    const data = await res.json();

    return data.map((c: any) => ({
      sha: c.sha,
      message: c.commit?.message ?? '',
      author: c.commit?.author?.name ?? c.author?.login ?? 'unknown',
      date: c.commit?.author?.date ?? '',
      url: c.html_url,
    }));
  } catch (err) {
    console.warn('[github-ingest] Failed to fetch commits:', err);
    return [];
  }
}

/**
 * Fetch open pull requests from the default repo, sorted by most recently updated.
 */
export async function fetchOpenPRs(userId: string): Promise<PRInfo[]> {
  const config = loadConfigOrNull(userId);
  if (!config) return [];

  try {
    const url = `${GITHUB_API}/repos/${config.defaultOwner}/${config.defaultRepo}/pulls?state=open&sort=updated&per_page=20`;
    const res = await fetch(url, { headers: buildHeaders(config.token) });

    if (!res.ok) {
      console.warn(`[github-ingest] PRs fetch failed (${res.status})`);
      return [];
    }

    const data = await res.json();

    return data.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body ?? null,
      url: pr.html_url,
      author: pr.user?.login ?? 'unknown',
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));
  } catch (err) {
    console.warn('[github-ingest] Failed to fetch PRs:', err);
    return [];
  }
}

/**
 * Fetch open issues (excluding PRs) from the default repo, sorted by most recently updated.
 */
export async function fetchRecentIssues(userId: string): Promise<IssueInfo[]> {
  const config = loadConfigOrNull(userId);
  if (!config) return [];

  try {
    const url = `${GITHUB_API}/repos/${config.defaultOwner}/${config.defaultRepo}/issues?state=open&sort=updated&per_page=20`;
    const res = await fetch(url, { headers: buildHeaders(config.token) });

    if (!res.ok) {
      console.warn(`[github-ingest] Issues fetch failed (${res.status})`);
      return [];
    }

    const data = await res.json();

    return data
      .filter((item: any) => !item.pull_request)
      .map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        url: issue.html_url,
        labels: (issue.labels ?? []).map((l: any) => l.name),
        createdAt: issue.created_at,
      }));
  } catch (err) {
    console.warn('[github-ingest] Failed to fetch issues:', err);
    return [];
  }
}

/**
 * Fetch and decode the README from the default repo.
 */
export async function fetchRepoReadme(userId: string): Promise<string | null> {
  const config = loadConfigOrNull(userId);
  if (!config) return null;

  try {
    const url = `${GITHUB_API}/repos/${config.defaultOwner}/${config.defaultRepo}/readme`;
    const res = await fetch(url, { headers: buildHeaders(config.token) });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.content) return null;

    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (err) {
    console.warn('[github-ingest] Failed to fetch README:', err);
    return null;
  }
}

/**
 * Sync all GitHub activity (commits, PRs, issues) into a flat list of ActivityItems.
 */
export async function syncGitHubActivity(userId: string): Promise<ActivityItem[]> {
  const [commits, prs, issues] = await Promise.all([
    fetchRecentCommits(userId),
    fetchOpenPRs(userId),
    fetchRecentIssues(userId),
  ]);

  const activities: ActivityItem[] = [];

  for (const c of commits) {
    activities.push({
      type: 'commit',
      title: c.message.split('\n')[0],
      body: c.message,
      url: c.url,
      githubId: c.sha,
      authoredAt: c.date,
    });
  }

  for (const pr of prs) {
    activities.push({
      type: 'pr',
      title: pr.title,
      body: pr.body,
      url: pr.url,
      githubId: `pr-${pr.number}`,
      authoredAt: pr.createdAt,
    });
  }

  for (const issue of issues) {
    activities.push({
      type: 'issue',
      title: issue.title,
      body: issue.body,
      url: issue.url,
      githubId: `issue-${issue.number}`,
      authoredAt: issue.createdAt,
    });
  }

  return activities;
}
