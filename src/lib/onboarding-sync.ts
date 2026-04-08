import fs from 'fs';
import path from 'path';

export type SyncSource = 'claude' | 'chatgpt';
export type SyncState = 'idle' | 'running' | 'completed' | 'failed' | 'auth_required';

export interface OnboardingSyncStatus {
  source: SyncSource;
  state: SyncState;
  startedAt?: string;
  finishedAt?: string;
  lookbackDays: number;
  importedMessages?: number;
  message?: string;
}

const STATUS_DIR = path.join(process.cwd(), 'data', 'onboarding-sync');
const CHECKPOINTS_PATH = path.join(STATUS_DIR, 'checkpoints.json');
const FINGERPRINTS_PATH = path.join(STATUS_DIR, 'fingerprints.json');

function ensureDir() {
  if (!fs.existsSync(STATUS_DIR)) {
    fs.mkdirSync(STATUS_DIR, { recursive: true });
  }
}

function statusPath(clerkId: string, source: SyncSource) {
  ensureDir();
  return path.join(STATUS_DIR, `${clerkId}-${source}.json`);
}

export function readSyncStatus(
  clerkId: string,
  source: SyncSource
): OnboardingSyncStatus {
  const filePath = statusPath(clerkId, source);
  if (!fs.existsSync(filePath)) {
    return {
      source,
      state: 'idle',
      lookbackDays: 3,
      importedMessages: 0,
    };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as OnboardingSyncStatus;
  } catch {
    return {
      source,
      state: 'idle',
      lookbackDays: 3,
      importedMessages: 0,
    };
  }
}

export function writeSyncStatus(
  clerkId: string,
  source: SyncSource,
  status: OnboardingSyncStatus
) {
  const filePath = statusPath(clerkId, source);
  fs.writeFileSync(filePath, JSON.stringify(status, null, 2));
}

type CheckpointMap = Record<string, string>;
type FingerprintMap = Record<string, string[]>;

function readJsonFile<T>(filePath: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, value: T) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function keyFor(clerkId: string, source: SyncSource) {
  return `${clerkId}:${source}`;
}

export function readLastSyncedAt(clerkId: string, source: SyncSource): string | null {
  const map = readJsonFile<CheckpointMap>(CHECKPOINTS_PATH, {});
  return map[keyFor(clerkId, source)] || null;
}

export function writeLastSyncedAt(clerkId: string, source: SyncSource, isoTimestamp: string) {
  const map = readJsonFile<CheckpointMap>(CHECKPOINTS_PATH, {});
  map[keyFor(clerkId, source)] = isoTimestamp;
  writeJsonFile(CHECKPOINTS_PATH, map);
}

export function buildMessageFingerprint(input: {
  source: string;
  role: string;
  content: string;
  sessionId?: string;
  timestamp?: string;
}): string {
  const base = [
    input.source,
    input.role,
    input.sessionId || '',
    input.timestamp || '',
    input.content.slice(0, 200),
  ].join('|');
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }
  return `${input.source}:${Math.abs(hash)}`;
}

export function readFingerprints(clerkId: string, source: SyncSource): Set<string> {
  const map = readJsonFile<FingerprintMap>(FINGERPRINTS_PATH, {});
  return new Set(map[keyFor(clerkId, source)] || []);
}

export function writeFingerprints(clerkId: string, source: SyncSource, fingerprints: Set<string>) {
  const map = readJsonFile<FingerprintMap>(FINGERPRINTS_PATH, {});
  const arr = [...fingerprints];
  const maxEntries = 2000;
  map[keyFor(clerkId, source)] = arr.slice(Math.max(0, arr.length - maxEntries));
  writeJsonFile(FINGERPRINTS_PATH, map);
}

export function clearOnboardingSyncForUser(clerkId: string) {
  ensureDir();
  for (const source of ['claude', 'chatgpt'] as const) {
    const filePath = statusPath(clerkId, source);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  const checkpoints = readJsonFile<CheckpointMap>(CHECKPOINTS_PATH, {});
  delete checkpoints[keyFor(clerkId, 'claude')];
  delete checkpoints[keyFor(clerkId, 'chatgpt')];
  writeJsonFile(CHECKPOINTS_PATH, checkpoints);

  const fingerprints = readJsonFile<FingerprintMap>(FINGERPRINTS_PATH, {});
  delete fingerprints[keyFor(clerkId, 'claude')];
  delete fingerprints[keyFor(clerkId, 'chatgpt')];
  writeJsonFile(FINGERPRINTS_PATH, fingerprints);
}
