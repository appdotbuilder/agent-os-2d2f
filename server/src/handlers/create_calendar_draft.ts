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
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to:
    // 1. Create a draft calendar event (not yet published to Google Calendar)
    // 2. Create an agent event for user approval
    // 3. Return both for display in SilentTray
    const mockAgentEvent: AgentEvent = {
        id: 0,
        workspace_id: input.workspace_id,
        agent: 'SchedulerAgent',
        action: 'create_calendar_event',
        input: input as Record<string, unknown>,
        output: null,
        status: 'awaiting_confirmation',
        created_at: new Date()
    };

    return Promise.resolve({
        draft_event: mockAgentEvent,
        calendar_event_preview: {
            title: input.title,
            description: input.description,
            start_time: input.start_time,
            end_time: input.end_time,
            attendees: input.attendees
        }
    });
};