/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: stop the Alter background daemon
 * DEPENDENCIES: None
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    // Read daemon status to get PID
    const statusPath = path.join(process.cwd(), 'data', 'daemon-status.json');
    
    if (!fs.existsSync(statusPath)) {
      return apiError('Daemon is not running', 400);
    }
    
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    
    if (!status.pid) {
      return apiError('No daemon PID found', 400);
    }
    
    // Kill the daemon process
    try {
      if (process.platform === 'win32') {
        await execAsync(`taskkill /PID ${status.pid} /F`);
      } else {
        await execAsync(`kill ${status.pid}`);
      }
      
      console.log(`[daemon/stop] Daemon stopped (PID ${status.pid})`);
      
      // Remove status file
      fs.unlinkSync(statusPath);
      
      return apiSuccess({
        message: 'Daemon stopped successfully',
        pid: status.pid,
      });
    } catch (err: any) {
      // Process might already be dead
      if (err.message.includes('not found') || err.message.includes('No such process')) {
        fs.unlinkSync(statusPath);
        return apiSuccess({
          message: 'Daemon was already stopped',
        });
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[daemon/stop] Error:', error);
    return apiError(`Failed to stop daemon: ${error.message}`, 500);
  }
}
