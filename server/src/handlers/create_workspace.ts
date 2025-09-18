import { db } from '../db';
import { workspacesTable } from '../db/schema';
import { type CreateWorkspaceInput, type Workspace } from '../schema';

export const createWorkspace = async (input: CreateWorkspaceInput): Promise<Workspace> => {
  try {
    // Insert workspace record
    const result = await db.insert(workspacesTable)
      .values({
        owner_id: input.owner_id,
        name: input.name,
        settings: input.settings || {}
      })
      .returning()
      .execute();

    const workspace = result[0];
    return {
      ...workspace,
      settings: workspace.settings as Record<string, unknown>
    };
  } catch (error) {
    console.error('Workspace creation failed:', error);
    throw error;
  }
};