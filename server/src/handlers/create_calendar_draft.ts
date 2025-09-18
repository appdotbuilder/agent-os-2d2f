import { db } from '../db';
import { agentEventsTable } from '../db/schema';
import { type CreateCalendarDraftInput, type AgentEvent } from '../schema';

export interface CalendarDraftResponse {
    draft_event: AgentEvent;
    calendar_event_preview: {
        title: string;
        description?: string;
        start_time: Date;
        end_time: Date;
        attendees?: string[];
    };
}

export const createCalendarDraft = async (input: CreateCalendarDraftInput): Promise<CalendarDraftResponse> => {
    try {
        // Create the calendar event preview object
        const calendar_event_preview = {
            title: input.title,
            description: input.description,
            start_time: input.start_time,
            end_time: input.end_time,
            attendees: input.attendees
        };

        // Create an agent event record for user approval
        const result = await db.insert(agentEventsTable)
            .values({
                workspace_id: input.workspace_id,
                agent: 'SchedulerAgent',
                action: 'create_calendar_event',
                input: input as any,
                output: null, // No output yet since it's awaiting confirmation
                status: 'awaiting_confirmation'
            })
            .returning()
            .execute();

        const draft_event = {
            ...result[0],
            input: result[0].input as Record<string, unknown>,
            output: result[0].output as Record<string, unknown> | null
        };

        return {
            draft_event,
            calendar_event_preview
        };
    } catch (error) {
        console.error('Calendar draft creation failed:', error);
        throw error;
    }
};