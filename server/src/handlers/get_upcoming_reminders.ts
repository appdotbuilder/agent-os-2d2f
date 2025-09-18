import { db } from '../db';
import { remindersTable, tasksTable } from '../db/schema';
import { type Reminder } from '../schema';
import { and, eq, gt, asc } from 'drizzle-orm';

export const getUpcomingReminders = async (workspaceId: number, limit?: number): Promise<Reminder[]> => {
  try {
    const now = new Date();
    const queryLimit = limit || 10;

    // Query reminders with associated tasks to filter by workspace
    const results = await db.select({
      id: remindersTable.id,
      task_id: remindersTable.task_id,
      remind_at: remindersTable.remind_at,
      method: remindersTable.method,
      status: remindersTable.status,
      created_at: remindersTable.created_at,
    })
      .from(remindersTable)
      .innerJoin(tasksTable, eq(remindersTable.task_id, tasksTable.id))
      .where(
        and(
          eq(tasksTable.workspace_id, workspaceId),
          gt(remindersTable.remind_at, now),
          eq(remindersTable.status, 'scheduled')
        )
      )
      .orderBy(asc(remindersTable.remind_at))
      .limit(queryLimit)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch upcoming reminders:', error);
    throw error;
  }
};