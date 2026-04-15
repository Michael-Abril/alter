/**
 * OWNER: Person 2 (Phillip/Backend)
 * PURPOSE: Canvas LMS API integration
 * DEPENDENCIES: None (uses fetch)
 * STATUS: LIVE — connects to Canvas REST API for academic data
 *
 * Canvas API Documentation: https://canvas.instructure.com/doc/api/
 * 
 * Students can generate API tokens in Canvas:
 * Account → Settings → New Access Token
 * 
 * Canvas credentials are stored in /data/canvas-config.json:
 * { "userId": { "token": "...", "domain": "..." } }
 */

import fs from 'fs';
import path from 'path';

export interface CanvasConfig {
  token: string;
  domain: string; // e.g., "babson.instructure.com"
}

/**
 * Hostname only — strips https://, paths, and trailing slashes so API URLs are valid.
 * Users often paste a full Canvas URL; without this, requests hit `https://https://...`.
 */
export function normalizeCanvasDomain(raw: string): string {
  let d = raw.trim();
  d = d.replace(/^https?:\/\//i, '');
  const slash = d.indexOf('/');
  if (slash !== -1) d = d.slice(0, slash);
  d = d.replace(/:\d+$/, '');
  return d.replace(/\.+$/, '').toLowerCase();
}

/**
 * Hostnames to try when validating Canvas API access. Many schools use a vanity URL
 * (e.g. canvas.babson.edu) for the web UI, but the REST API lives on Canvas Cloud:
 * babson.instructure.com. Without the Instructure host, /api/v1/... may return HTML.
 */
export function canvasHostCandidates(normalizedHost: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (h: string) => {
    if (!h || seen.has(h)) return;
    seen.add(h);
    out.push(h);
  };

  if (normalizedHost.endsWith('.instructure.com')) {
    push(normalizedHost);
    return out;
  }

  const m = /^canvas\.([a-z0-9-]+)\.([a-z0-9.-]+)$/i.exec(normalizedHost);
  if (m && m[1].toLowerCase() !== 'instructure') {
    // Prefer Cloud API host first; vanity canvas.school.edu often returns HTML for /api/v1.
    push(`${m[1].toLowerCase()}.instructure.com`);
    push(normalizedHost);
    return out;
  }

  push(normalizedHost);
  return out;
}

/** True if body looks like JSON (avoids parsing HTML error pages as JSON). */
export function tryParseCanvasJson(text: string): Record<string, unknown> | null {
  const t = text.trimStart();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    const v = JSON.parse(text) as unknown;
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

interface CanvasConfigFile {
  [userId: string]: CanvasConfig;
}

const CONFIG_PATH = path.join(process.cwd(), 'data', 'canvas-config.json');

/**
 * Load Canvas config for a user from JSON file
 */
export function loadCanvasConfig(userId: string): CanvasConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return null;
    }
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config: CanvasConfigFile = JSON.parse(data);
    return config[userId] || null;
  } catch {
    return null;
  }
}

/**
 * Save Canvas config for a user to JSON file
 */
export function saveCanvasConfig(userId: string, config: CanvasConfig): void {
  let allConfigs: CanvasConfigFile = {};
  
  // Load existing configs
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      allConfigs = JSON.parse(data);
    } catch {
      // Start fresh if file is corrupted
    }
  } else {
    // Create directory if it doesn't exist
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  // Update config for this user
  allConfigs[userId] = config;
  
  // Save back to file
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(allConfigs, null, 2));
}

/**
 * Delete Canvas config for a user
 */
export function deleteCanvasConfig(userId: string): void {
  if (!fs.existsSync(CONFIG_PATH)) {
    return;
  }
  
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const allConfigs: CanvasConfigFile = JSON.parse(data);
    delete allConfigs[userId];
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(allConfigs, null, 2));
  } catch {
    // Ignore errors
  }
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  workflow_state: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  course_id: number;
  html_url: string;
  submission_types: string[];
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  author: {
    display_name: string;
  };
  context_code: string;
}

/**
 * Make a Canvas API request
 */
async function canvasRequest<T>(
  config: CanvasConfig,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`https://${config.domain}/api/v1${endpoint}`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Canvas API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get all enrolled courses for the current user
 */
export async function getCourses(config: CanvasConfig): Promise<CanvasCourse[]> {
  const courses = await canvasRequest<CanvasCourse[]>(config, '/courses', {
    'enrollment_state': 'active',
    'per_page': '100',
  });

  return courses.filter(course => course.workflow_state === 'available');
}

/**
 * Get upcoming assignments due in the next N days
 */
export async function getUpcomingAssignments(
  config: CanvasConfig,
  daysAhead: number = 14
): Promise<CanvasAssignment[]> {
  const courses = await getCourses(config);
  const allAssignments: CanvasAssignment[] = [];

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  for (const course of courses) {
    try {
      const assignments = await canvasRequest<CanvasAssignment[]>(
        config,
        `/courses/${course.id}/assignments`,
        {
          'per_page': '100',
          'order_by': 'due_at',
        }
      );

      // Filter to only upcoming assignments
      const upcoming = assignments.filter(assignment => {
        if (!assignment.due_at) return false;
        const dueDate = new Date(assignment.due_at);
        return dueDate >= now && dueDate <= futureDate;
      });

      allAssignments.push(...upcoming);
    } catch (err) {
      console.error(`Failed to fetch assignments for course ${course.id}:`, err);
    }
  }

  // Sort by due date
  allAssignments.sort((a, b) => {
    const dateA = new Date(a.due_at!);
    const dateB = new Date(b.due_at!);
    return dateA.getTime() - dateB.getTime();
  });

  return allAssignments;
}

/** Minimal rows for project classifier ↔ Canvas cross-reference */
export type CanvasRefForClassifier = {
  name: string;
  courseCode: string;
};

/**
 * Course codes + assignment names for matching chat threads to Canvas work.
 * Includes assignments due roughly within the last 120 days through the next 180 days.
 */
export async function getCanvasRefsForClassifier(
  config: CanvasConfig
): Promise<CanvasRefForClassifier[]> {
  const courses = await getCourses(config);
  const out: CanvasRefForClassifier[] = [];
  const now = Date.now();
  const minDue = now - 120 * 24 * 60 * 60 * 1000;
  const maxDue = now + 180 * 24 * 60 * 60 * 1000;

  const seen = new Set<string>();

  const push = (name: string, courseCode: string) => {
    const n = name.trim();
    const c = courseCode.trim();
    if (!n && !c) return;
    const key = `${n.toLowerCase()}|${c.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: n || c, courseCode: c || n });
  };

  for (const course of courses) {
    const code = (course.course_code || course.name || '').trim();
    if (code) push(course.name || code, code);

    try {
      const assignments = await canvasRequest<CanvasAssignment[]>(
        config,
        `/courses/${course.id}/assignments`,
        { per_page: '100', order_by: 'due_at' }
      );

      for (const a of assignments) {
        const codeForRow = code || `Course ${course.id}`;
        if (!a.due_at) {
          push(a.name, codeForRow);
          continue;
        }
        const due = new Date(a.due_at).getTime();
        if (due >= minDue && due <= maxDue) {
          push(a.name, codeForRow);
        }
      }
    } catch (err) {
      console.error(`[getCanvasRefsForClassifier] course ${course.id}:`, err);
    }
  }

  return out;
}

/**
 * Get recent course announcements
 */
export async function getAnnouncements(
  config: CanvasConfig,
  daysBack: number = 14
): Promise<CanvasAnnouncement[]> {
  const courses = await getCourses(config);
  const allAnnouncements: CanvasAnnouncement[] = [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  for (const course of courses) {
    try {
      const announcements = await canvasRequest<CanvasAnnouncement[]>(
        config,
        `/courses/${course.id}/discussion_topics`,
        {
          'only_announcements': 'true',
          'per_page': '50',
        }
      );

      // Filter to recent announcements
      const recent = announcements.filter(announcement => {
        const postedDate = new Date(announcement.posted_at);
        return postedDate >= cutoffDate;
      });

      allAnnouncements.push(...recent);
    } catch (err) {
      console.error(`Failed to fetch announcements for course ${course.id}:`, err);
    }
  }

  // Sort by posted date (newest first)
  allAnnouncements.sort((a, b) => {
    const dateA = new Date(a.posted_at);
    const dateB = new Date(b.posted_at);
    return dateB.getTime() - dateA.getTime();
  });

  return allAnnouncements;
}

/**
 * Course syllabus HTML as plain text (truncated). Requires syllabus on the course in Canvas.
 */
export async function getCourseSyllabusBody(
  config: CanvasConfig,
  courseId: number
): Promise<string | null> {
  try {
    const url = new URL(`https://${config.domain}/api/v1/courses/${courseId}`);
    url.searchParams.append('include[]', 'syllabus_body');
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { syllabus_body?: string };
    const raw = data.syllabus_body;
    if (!raw || !String(raw).trim()) return null;
    return String(raw)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
  } catch {
    return null;
  }
}

export interface CanvasConversationSummary {
  id: number;
  subject: string;
  preview: string;
  updatedAt: string;
}

function conversationPreview(c: Record<string, unknown>): string {
  const lm = c.last_message as Record<string, unknown> | string | undefined;
  if (!lm) return '';
  if (typeof lm === 'string') return lm.slice(0, 400);
  const body = (lm.body as string) || (lm.preview as string) || '';
  return String(body)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/**
 * Canvas internal inbox (Conversations). Capped list.
 */
export async function getRecentConversations(
  config: CanvasConfig,
  max: number = 15
): Promise<CanvasConversationSummary[]> {
  try {
    const raw = (await canvasRequest<unknown>(config, '/conversations', {
      per_page: String(Math.min(Math.max(max, 1), 50)),
    })) as unknown[] | Record<string, unknown>;

    const list: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { conversations?: unknown[] }).conversations)
        ? (raw as { conversations: unknown[] }).conversations
        : [];

    return list.slice(0, max).map((item) => {
      const c = item as Record<string, unknown>;
      return {
        id: Number(c.id) || 0,
        subject: String(c.subject || '(no subject)'),
        preview: conversationPreview(c),
        updatedAt: String(
          c.last_message_at || c.updated_at || new Date().toISOString()
        ),
      };
    });
  } catch (e) {
    console.warn('[canvas] getRecentConversations:', e);
    return [];
  }
}

/**
 * Validate Canvas credentials by attempting to fetch user profile
 */
export async function validateCredentials(config: CanvasConfig): Promise<boolean> {
  try {
    await canvasRequest(config, '/users/self', {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Get course name by ID (helper for formatting)
 */
export async function getCourseName(config: CanvasConfig, courseId: number): Promise<string> {
  try {
    const course = await canvasRequest<CanvasCourse>(config, `/courses/${courseId}`, {});
    return course.course_code || course.name;
  } catch {
    return `Course ${courseId}`;
  }
}
