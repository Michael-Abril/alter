/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: GET: return daemon status (running, last refresh, next scheduled runs)
 * DEPENDENCIES: None
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    // Read daemon state from status file
    const statusPath = path.join(process.cwd(), 'data', 'daemon-status.json');
    
    if (!fs.existsSync(statusPath)) {
      return apiSuccess({
        running: false,
        message: 'Daemon not running',
      });
    }
    
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    
    // Check if status is stale (no update in last 2 minutes)
    const lastUpdate = new Date(status.lastUpdate);
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;
    
    if (minutesSinceUpdate > 2) {
      return apiSuccess({
        running: false,
        message: 'Daemon appears to be stopped (no recent updates)',
        lastUpdate: status.lastUpdate,
      });
    }
    
    return apiSuccess({
      running: status.running,
      testMode: status.testMode,
      lastRefresh: status.lastRefresh,
      lastOvernightRun: status.lastOvernightRun,
      lastBriefGenerated: status.lastBriefGenerated,
      nextOvernightRun: status.nextOvernightRun,
      nextBrief: status.nextBrief,
      startTime: status.startTime,
      refreshCount: status.refreshCount,
      overnightRunCount: status.overnightRunCount,
      briefCount: status.briefCount,
      refreshInterval: status.refreshInterval,
    });
  } catch (error: any) {
    console.error('[daemon/status] Error:', error);
    return apiError(`Failed to get daemon status: ${error.message}`, 500);
  }
}
