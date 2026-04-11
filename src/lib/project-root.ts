import fs from 'fs';
import path from 'path';

/**
 * Resolves the NightShift repo root even when Next/Turbopack runs with cwd above
 * the project (e.g. parent folder with another lockfile).
 */
export function resolveNightshiftProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const marker = path.join(dir, 'orchestration', 'scrape-claude.mjs');
    if (fs.existsSync(marker)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
