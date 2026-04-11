/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: start the Alter background daemon
 * DEPENDENCIES: None
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const testMode = body.testMode || false;
    
    // Start daemon as a detached background process
    const daemonPath = path.join(process.cwd(), 'orchestration', 'nightshift-daemon.mjs');
    const args = testMode ? ['--test'] : [];
    
    const daemon = spawn('node', [daemonPath, ...args], {
      detached: true,
      stdio: 'ignore',
    });
    
    daemon.unref();
    
    console.log(`[daemon/start] Daemon started with PID ${daemon.pid} (test mode: ${testMode})`);
    
    return apiSuccess({
      message: 'Daemon started successfully',
      pid: daemon.pid,
      testMode,
    });
  } catch (error: any) {
    console.error('[daemon/start] Error:', error);
    return apiError(`Failed to start daemon: ${error.message}`, 500);
  }
}
