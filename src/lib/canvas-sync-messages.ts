/**
 * Build Canvas LMS rows for chat ingest (assignments, announcements, syllabus, inbox).
 * Used by POST /api/canvas/sync and onboarding integration snapshot.
 */

import type { CanvasConfig } from '@/lib/canvas';
import {
  getCourses,
  getUpcomingAssignments,
  getAnnouncements,
  getCourseSyllabusBody,
  getRecentConversations,
} from '@/lib/canvas';

export interface CanvasIngestMessage {
  role: string;
  content: string;
  sessionId: string;
  timestamp: string;
}

export async function buildCanvasIngestMessages(
  config: CanvasConfig,
  options?: {
    daysAhead?: number;
    daysBack?: number;
    maxSyllabusCourses?: number;
    maxConversations?: number;
    includeSyllabus?: boolean;
    includeConversations?: boolean;
  }
): Promise<CanvasIngestMessage[]> {
  const daysAhead = options?.daysAhead ?? 14;
  const daysBack = options?.daysBack ?? 14;
  const maxSyllabusCourses = options?.maxSyllabusCourses ?? 10;
  const maxConversations = options?.maxConversations ?? 12;
  const includeSyllabus = options?.includeSyllabus !== false;
  const includeConversations = options?.includeConversations !== false;

  const courses = await getCourses(config);
  const assignments = await getUpcomingAssignments(config, daysAhead);
  const announcements = await getAnnouncements(config, daysBack);

  const messages: CanvasIngestMessage[] = [];

  for (const assignment of assignments) {
    const course = courses.find((c) => c.id === assignment.course_id);
    const courseName =
      course?.course_code || course?.name || `Course ${assignment.course_id}`;

    if (!assignment.due_at) continue;

    const dueDate = new Date(assignment.due_at);
    const dueDateStr = dueDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const description = assignment.description
      ? assignment.description.replace(/<[^>]*>/g, '').trim().slice(0, 500)
      : 'No description provided';

    const content = `Assignment: ${courseName} - ${assignment.name} due ${dueDateStr}. ${description}`;

    messages.push({
      role: 'user',
      content,
      sessionId: `canvas-${courseName}`,
      timestamp: new Date().toISOString(),
    });
  }

  for (const announcement of announcements) {
    const contextCode = announcement.context_code || 'unknown';
    const courseName = contextCode.replace('course_', 'Course ');

    const postedDate = new Date(announcement.posted_at).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric' }
    );

    const message = announcement.message
      ? announcement.message.replace(/<[^>]*>/g, '').trim().slice(0, 500)
      : '';

    const content = `Announcement from ${courseName} (${postedDate}): ${announcement.title || 'Untitled'}. ${message}`;

    messages.push({
      role: 'assistant',
      content,
      sessionId: `canvas-${courseName}`,
      timestamp: announcement.posted_at,
    });
  }

  if (includeSyllabus && maxSyllabusCourses > 0) {
    for (const course of courses.slice(0, maxSyllabusCourses)) {
      try {
        const body = await getCourseSyllabusBody(config, course.id);
        if (!body) continue;
        const label = course.course_code || course.name || `Course ${course.id}`;
        const snippet = body.slice(0, 6000);
        messages.push({
          role: 'user',
          content: `Syllabus (${label}): ${snippet}`,
          sessionId: `canvas-syllabus-${course.id}`,
          timestamp: new Date().toISOString(),
        });
      } catch {
        /* skip course */
      }
    }
  }

  if (includeConversations && maxConversations > 0) {
    const convs = await getRecentConversations(config, maxConversations);
    for (const c of convs) {
      if (!c.id) continue;
      messages.push({
        role: 'user',
        content: `Canvas inbox [${c.subject}]: ${c.preview || '(no preview)'}`,
        sessionId: 'canvas-inbox',
        timestamp: c.updatedAt,
      });
    }
  }

  return messages;
}
