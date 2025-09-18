import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type CreateTaskInput, type Task } from '../schema';

export const createTask = async (input: CreateTaskInput): Promise<Task> => {
  try {
    // Insert task record
    const result = await db.insert(tasksTable)
      .values({
        workspace_id: input.workspace_id,
        title: input.title,
        description: input.description || null,
        status: input.status || 'todo',
        priority: input.priority || 'med',
        due_at: input.due_at || null,
        assignee_id: input.assignee_id || null,
        linked_note_id: input.linked_note_id || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task creation failed:', error);
    throw error;
  }
};