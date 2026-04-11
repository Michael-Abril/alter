/**
 * Async server component for tasks today.
 * Fetches its own data - wrap in Suspense for streaming.
 */

import { buildTodayTasks, type TodayTask } from '@/lib/tasks-today';
import TasksTodaySection from './TasksTodaySection';

type Props = {
  userId: string;
};

export default async function TasksTodayAsync({ userId }: Props) {
  let tasks: TodayTask[] = [];
  try {
    tasks = await buildTodayTasks(userId);
  } catch {
    // Return empty tasks on error
  }

  return <TasksTodaySection tasks={tasks} />;
}
