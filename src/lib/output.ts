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
 * Get the default output directory based on OS
 */
export function getDefaultOutputDirectory(): string {
  const homeDir = os.homedir();
  const username = os.userInfo().username;
  
  if (process.platform === 'win32') {
    return path.join('C:', 'Users', username, 'Documents', 'Alter');
  } else if (process.platform === 'darwin') {
    return path.join(homeDir, 'Documents', 'Alter');
  } else {
    return path.join(homeDir, 'Documents', 'Alter');
  }
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
  
  return { outputDirectory: getDefaultOutputDirectory() };
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

/**
 * Get the configured output directory, creating it if it doesn't exist
 */
export function getOutputDirectory(): string {
  const config = loadConfig();
  const outputDir = config.outputDirectory;
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`[output] Created output directory: ${outputDir}`);
    } catch (err) {
      console.error(`[output] Failed to create output directory: ${outputDir}`, err);
      throw err;
    }
  }
  
  return outputDir;
}

/**
 * Set a custom output directory
 */
export function setOutputDirectory(directory: string): void {
  const config = loadConfig();
  config.outputDirectory = directory;
  saveConfig(config);
  
  // Create the directory
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  
  console.log(`[output] Output directory set to: ${directory}`);
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
