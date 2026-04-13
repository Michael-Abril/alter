/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Output directory management — configurable location for Alter outputs
 * DEPENDENCIES: fs, path, os
 * STATUS: LIVE — manages user-facing output directory
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'user-config.json');

interface UserConfig {
  outputDirectory: string;
}

/**
 * Get the default output directory based on OS (user Documents)
 */
export function getDefaultOutputDirectory(): string {
  try {
    const homeDir = os.homedir();
    return path.join(homeDir, 'Documents', 'Alter');
  } catch {
    return path.join(process.cwd(), 'data', 'output');
  }
}

function repoFallbackOutput(): string {
  return path.join(process.cwd(), 'data', 'output');
}

/**
 * Load user config from disk
 */
function loadConfig(): UserConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[output] Failed to load config:', err);
  }

  return { outputDirectory: 'data/output' };
}

/**
 * Save user config to disk
 */
function saveConfig(config: UserConfig): void {
  try {
    const dataDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[output] Failed to save config:', err);
  }
}

/** Resolve a stored path — relative paths are under process.cwd() (repo root). */
function resolveOutputPath(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return repoFallbackOutput();
  return path.isAbsolute(t) ? t : path.join(process.cwd(), t);
}

/**
 * Try to create dir and verify writable (orchestration / API only)
 */
function tryEnsureWritable(dir: string): boolean {
  if (typeof window !== 'undefined') return false;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.nightshift-write-test');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the configured output directory, creating it if it doesn't exist.
 * Tries, in order: NIGHTSHIFT_OUTPUT_DIR → user-config → repo data/output → ~/Documents/Alter
 */
export function getOutputDirectory(): string {
  if (typeof window !== 'undefined') {
    return repoFallbackOutput();
  }

  const candidates: string[] = [];

  if (process.env.NIGHTSHIFT_OUTPUT_DIR) {
    candidates.push(resolveOutputPath(process.env.NIGHTSHIFT_OUTPUT_DIR));
  }

  const cfg = loadConfig();
  candidates.push(resolveOutputPath(cfg.outputDirectory));
  candidates.push(repoFallbackOutput());
  candidates.push(getDefaultOutputDirectory());

  const tried = new Set<string>();
  for (const dir of candidates) {
    const norm = path.normalize(dir);
    if (tried.has(norm)) continue;
    tried.add(norm);

    if (tryEnsureWritable(norm)) {
      return norm;
    }
    console.warn(`[output] Path not usable, trying next: ${norm}`);
  }

  throw new Error(
    '[output] Could not create a writable output directory. Set NIGHTSHIFT_OUTPUT_DIR to a folder you can write to (e.g. data/output).'
  );
}

/**
 * Set a custom output directory
 */
export function setOutputDirectory(directory: string): void {
  const config = loadConfig();
  config.outputDirectory = directory;
  saveConfig(config);

  const resolved = resolveOutputPath(directory);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  console.log(`[output] Output directory set to: ${resolved}`);
}

/**
 * Generate a safe filename from a project name
 */
export function generateFilename(projectName: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return `${safeName}-${timestamp}.${extension}`;
}

/**
 * Get the full path for an output file
 */
export function getOutputPath(projectName: string, extension: string): string {
  const outputDir = getOutputDirectory();
  const filename = generateFilename(projectName, extension);
  return path.join(outputDir, filename);
}
