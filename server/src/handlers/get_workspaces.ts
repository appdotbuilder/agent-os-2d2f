import { db } from '../db';
import { workspacesTable } from '../db/schema';
import { type Workspace } from '../schema';
import { eq } from 'drizzle-orm';

export const getWorkspaces = async (userId: number): Promise<Workspace[]> => {
  try {
    // Fetch all workspaces where the user is the owner
    // Note: For now, only handling owner_id. Future extension would include
    // member relationships through a workspace_members table
    const results = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.owner_id, userId))
      .execute();

    // Convert the database results to match the schema type
    return results.map(workspace => ({
      ...workspace,
      settings: workspace.settings as Record<string, unknown>
    }));
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);
    throw error;
  }
};