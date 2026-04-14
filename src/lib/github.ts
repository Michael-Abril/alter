/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GitHub API integration for Alter
 * DEPENDENCIES: None (uses fetch)
 * STATUS: LIVE — enables code push to GitHub via PRs
 * 
 * GitHub API Documentation: https://docs.github.com/en/rest
 * 
 * Credentials stored in /data/github-config.json per user:
 * { "userId": { "token": "...", "defaultOwner": "...", "defaultRepo": "...", "defaultBranch": "main" } }
 */

import fs from 'fs';
import path from 'path';

export interface GitHubConfig {
  token: string;
  defaultOwner: string;
  defaultRepo: string;
  defaultBranch: string;
}

interface GitHubConfigFile {
  [userId: string]: GitHubConfig;
}

const CONFIG_PATH = path.join(process.cwd(), 'data', 'github-config.json');

/**
 * Load GitHub config for a user from JSON file
 */
export function loadGitHubConfig(userId: string): GitHubConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return null;
    }
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config: GitHubConfigFile = JSON.parse(data);
    return config[userId] || null;
  } catch {
    return null;
  }
}

/**
 * Save GitHub config for a user to JSON file
 */
export function saveGitHubConfig(userId: string, config: GitHubConfig): void {
  let allConfigs: GitHubConfigFile = {};
  
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      allConfigs = JSON.parse(data);
    } catch {
      // If parse fails, start fresh
    }
  }
  
  allConfigs[userId] = config;
  
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(allConfigs, null, 2), 'utf-8');
}

/**
 * Delete GitHub config for a user
 */
export function deleteGitHubConfig(userId: string): void {
  if (!fs.existsSync(CONFIG_PATH)) return;
  
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const allConfigs: GitHubConfigFile = JSON.parse(data);
    delete allConfigs[userId];
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(allConfigs, null, 2), 'utf-8');
  } catch {
    // Ignore errors
  }
}

// ─── GitHub API Functions ────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com';

interface GitHubApiOptions {
  method?: string;
  body?: any;
}

async function githubApi(token: string, endpoint: string, options: GitHubApiOptions = {}) {
  const url = `${GITHUB_API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Alter-AI',
  };
  
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

/**
 * Verify access to a repository
 */
export async function getRepo(token: string, owner: string, repo: string) {
  return githubApi(token, `/repos/${owner}/${repo}`);
}

/**
 * Get current branch state
 */
export async function getBranch(token: string, owner: string, repo: string, branch: string) {
  return githubApi(token, `/repos/${owner}/${repo}/branches/${branch}`);
}

/**
 * Get reference (for branch operations)
 */
export async function getRef(token: string, owner: string, repo: string, ref: string) {
  return githubApi(token, `/repos/${owner}/${repo}/git/refs/${ref}`);
}

/**
 * Create a new branch from a base branch
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  baseBranch: string,
  newBranch: string
) {
  // Get the SHA of the base branch
  const baseRef = await getRef(token, owner, repo, `heads/${baseBranch}`);
  const baseSha = baseRef.object.sha;
  
  // Create new branch reference
  return githubApi(token, `/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: {
      ref: `refs/heads/${newBranch}`,
      sha: baseSha,
    },
  });
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  branch?: string
) {
  const ref = branch ? `?ref=${branch}` : '';
  try {
    return await githubApi(token, `/repos/${owner}/${repo}/contents/${filePath}${ref}`);
  } catch (error) {
    // File doesn't exist
    return null;
  }
}

/**
 * Commit a file to a branch (creates or updates)
 */
export async function commitFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  message: string
) {
  // Check if file exists to get its SHA (needed for updates)
  const existingFile = await getFileContent(token, owner, repo, filePath, branch);
  
  // Encode content to base64
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');
  
  const body: any = {
    message,
    content: contentBase64,
    branch,
  };
  
  if (existingFile) {
    body.sha = existingFile.sha;
  }
  
  return githubApi(token, `/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    body,
  });
}

/**
 * Create a pull request
 */
export async function createPR(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
) {
  return githubApi(token, `/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: {
      title,
      body,
      head,
      base,
    },
  });
}

/**
 * List user's repositories
 */
export async function listRepos(token: string, perPage: number = 100) {
  return githubApi(token, `/user/repos?per_page=${perPage}&sort=updated`);
}

/**
 * Get authenticated user info
 */
export async function getUser(token: string) {
  return githubApi(token, '/user');
}

/**
 * Check if a branch exists
 */
export async function branchExists(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<boolean> {
  try {
    await getBranch(token, owner, repo, branch);
    return true;
  } catch {
    return false;
  }
}
