import { db } from '../db';
import { agentEventsTable, workspacesTable } from '../db/schema';
import { type AgentProposeInput, type AgentEvent } from '../schema';
import { eq } from 'drizzle-orm';

export interface AgentProposalResponse {
    agent_event: AgentEvent;
    rationale: string;
}

export const agentPropose = async (input: AgentProposeInput): Promise<AgentProposalResponse> => {
    try {
        // Verify workspace exists to ensure foreign key constraint is satisfied
        const workspace = await db.select()
            .from(workspacesTable)
            .where(eq(workspacesTable.id, input.workspace_id))
            .limit(1)
            .execute();

        if (workspace.length === 0) {
            throw new Error(`Workspace with id ${input.workspace_id} not found`);
        }

        // Create a draft agent event for user approval
        const result = await db.insert(agentEventsTable)
            .values({
                workspace_id: input.workspace_id,
                agent: input.agent,
                action: input.action,
                input: input.input,
                output: null,
                status: 'awaiting_confirmation'
            })
            .returning()
            .execute();

        const agentEvent = result[0];

        return {
            agent_event: agentEvent as AgentEvent,
            rationale: input.rationale
        };
    } catch (error) {
        console.error('Agent proposal creation failed:', error);
        throw error;
    }
};