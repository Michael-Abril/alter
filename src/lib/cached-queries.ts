/**
 * Request-level cached database queries for dashboard.
 * Uses React's cache() for request deduplication.
 */

import { cache } from 'react';
import db from '@/lib/db';

/**
 * Cached project count - fast indexed query.
 */
export const getCachedProjectCount = cache(async (userId: string) => {
  return db.project.count({ where: { userId } });
});

/**
 * Cached chat message count - fast indexed query.
 */
export const getCachedChatCount = cache(async (userId: string) => {
  return db.chatMessage.count({ where: { userId } });
});

/**
 * Cached embedded message count.
 */
export const getCachedEmbeddedCount = cache(async (userId: string) => {
  return db.chatMessage.count({ where: { userId, embedded: true } });
});

/**
 * Cached session count (grouped by sessionId).
 */
export const getCachedSessionCount = cache(async (userId: string) => {
  const sessions = await db.chatMessage.groupBy({
    by: ['sessionId'],
    where: { userId },
  });
  return sessions.length;
});

/**
 * Cached pending drafts count.
 */
export const getCachedPendingDraftsCount = cache(async (userId: string) => {
  return db.draft.count({ where: { userId, status: 'pending' } });
});

/**
 * Cached in-progress projects for suggested focus.
 */
export const getCachedInProgressProjects = cache(async (userId: string) => {
  return db.project.findMany({
    where: { userId, status: 'in_progress' },
    orderBy: { progress: 'desc' },
    take: 4,
    select: {
      id: true,
      name: true,
      progress: true,
      context: true,
    },
  });
});

/**
 * Cached overnight work count (last 24h).
 */
export const getCachedOvernightWorkCount = cache(async (userId: string) => {
  const since24h = new Date();
  since24h.setDate(since24h.getDate() - 1);
  return db.action.count({
    where: { userId, type: 'work_continued', createdAt: { gte: since24h } },
  });
});

/**
 * Cached overnight draft count (last 24h).
 */
export const getCachedOvernightDraftCount = cache(async (userId: string) => {
  const since24h = new Date();
  since24h.setDate(since24h.getDate() - 1);
  return db.draft.count({
    where: { userId, type: 'email', createdAt: { gte: since24h } },
  });
});
