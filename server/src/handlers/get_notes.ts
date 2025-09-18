import { db } from '../db';
import { notesTable } from '../db/schema';
import { type Note } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getNotes = async (workspaceId: number): Promise<Note[]> => {
  try {
    // Query notes for the workspace, ordered by created_at desc
    const results = await db.select()
      .from(notesTable)
      .where(eq(notesTable.workspace_id, workspaceId))
      .orderBy(desc(notesTable.created_at))
      .execute();

    // Return the results with proper type casting for entities field
    return results.map(note => ({
      ...note,
      entities: note.entities as Record<string, unknown>
    }));
  } catch (error) {
    console.error('Get notes failed:', error);
    throw error;
  }
};