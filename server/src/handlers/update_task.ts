import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type UpdateTaskInput, type Task } from '../schema';
import { eq } from 'drizzle-orm';

export const updateTask = async (input: UpdateTaskInput): Promise<Task> => {
  try {
    // First, check if the task exists
    const existingTasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, input.id))
      .execute();

    if (existingTasks.length === 0) {
      throw new Error(`Task with id ${input.id} not found`);
    }

    // Build the update object with only provided fields
    const updateData: Partial<typeof tasksTable.$inferInsert> = {
      updated_at: new Date()
    };

    // Only include fields that are provided in the input
    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.priority !== undefined) {
      updateData.priority = input.priority;
    }
    if (input.due_at !== undefined) {
      updateData.due_at = input.due_at;
    }
    if (input.assignee_id !== undefined) {
      updateData.assignee_id = input.assignee_id;
    }
    if (input.linked_note_id !== undefined) {
      updateData.linked_note_id = input.linked_note_id;
    }

    // Update the task
    const result = await db.update(tasksTable)
      .set(updateData)
      .where(eq(tasksTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task update failed:', error);
    throw error;
  }
};