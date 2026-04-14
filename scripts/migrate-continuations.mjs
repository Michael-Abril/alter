/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Migrate existing continuations from /data/continuations/ to new output directory
 * DEPENDENCIES: fs, path
 * STATUS: One-time migration script
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOutputDirectory } from '../src/lib/output.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oldDir = path.join(__dirname, '..', 'data', 'continuations');
const newDir = getOutputDirectory();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 Migrating Continuations to New Output Directory');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`From: ${oldDir}`);
console.log(`To:   ${newDir}`);
console.log('');

if (!fs.existsSync(oldDir)) {
  console.log('✅ No old continuations directory found. Nothing to migrate.');
  process.exit(0);
}

const files = fs.readdirSync(oldDir);

if (files.length === 0) {
  console.log('✅ No files to migrate.');
  process.exit(0);
}

console.log(`Found ${files.length} files to migrate...`);
console.log('');

let migrated = 0;
let skipped = 0;

for (const file of files) {
  const oldPath = path.join(oldDir, file);
  const newPath = path.join(newDir, file);
  
  // Skip if not a file
  if (!fs.statSync(oldPath).isFile()) {
    continue;
  }
  
  // Skip if file already exists in new location
  if (fs.existsSync(newPath)) {
    console.log(`⏭️  Skipped (already exists): ${file}`);
    skipped++;
    continue;
  }
  
  // Copy file
  fs.copyFileSync(oldPath, newPath);
  console.log(`✅ Migrated: ${file}`);
  migrated++;
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Migration complete!`);
console.log(`   Migrated: ${migrated} files`);
console.log(`   Skipped:  ${skipped} files`);
console.log('');
console.log(`📁 All continuations are now in: ${newDir}`);
console.log('');
console.log('💡 You can safely delete the old directory:');
console.log(`   rm -rf ${oldDir}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
