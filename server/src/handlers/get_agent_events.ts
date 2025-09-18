import { db } from '../db';
import { agentEventsTable } from '../db/schema';
import { type AgentEvent } from '../schema';
import { eq, desc, and, type SQL } from 'drizzle-orm';

export const getAgentEvents = async (workspaceId: number, status?: 'draft' | 'awaiting_confirmation' | 'executed' | 'error'): Promise<AgentEvent[]> => {
  try {
    // Build the query with proper condition handling
    const baseQuery = db.select().from(agentEventsTable);
    
    let finalQuery;
    
    if (status) {
      // Both workspace_id and status conditions
      finalQuery = baseQuery
        .where(and(
          eq(agentEventsTable.workspace_id, workspaceId),
          eq(agentEventsTable.status, status)
        ))
        .orderBy(desc(agentEventsTable.created_at));
    } else {
      // Only workspace_id condition
      finalQuery = baseQuery
        .where(eq(agentEventsTable.workspace_id, workspaceId))
        .orderBy(desc(agentEventsTable.created_at));
    }

    const results = await finalQuery.execute();

    // Return results with proper type casting for JSON fields
    return results.map(result => ({
      ...result,
      input: result.input as Record<string, unknown>,
      output: result.output as Record<string, unknown> | null
    }));
  } catch (error) {
    console.error('Get agent events failed:', error);
    throw error;
  }
};