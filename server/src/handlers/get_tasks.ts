import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type Task } from '../schema';
import { eq } from 'drizzle-orm';

export const getTasks = async (workspaceId: number): Promise<Task[]> => {
  try {
    const results = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.workspace_id, workspaceId))
      .execute();

    // Return tasks with proper type conversion for dates
    return results.map(task => ({
      ...task,
      due_at: task.due_at ? new Date(task.due_at) : null,
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at)
    }));
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    throw error;
  }
};