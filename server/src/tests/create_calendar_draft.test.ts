import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type CreateCalendarDraftInput } from '../schema';
import { createCalendarDraft } from '../handlers/create_calendar_draft';
import { eq } from 'drizzle-orm';

describe('createCalendarDraft', () => {
    let testUserId: number;
    let testWorkspaceId: number;

    beforeEach(async () => {
        await createDB();

        // Create prerequisite user
        const userResult = await db.insert(usersTable)
            .values({
                email: 'test@example.com',
                display_name: 'Test User',
                timezone: 'UTC',
                llm_provider: 'openai',
                llm_model: 'gpt-4'
            })
            .returning()
            .execute();
        testUserId = userResult[0].id;

        // Create prerequisite workspace
        const workspaceResult = await db.insert(workspacesTable)
            .values({
                owner_id: testUserId,
                name: 'Test Workspace',
                settings: {}
            })
            .returning()
            .execute();
        testWorkspaceId = workspaceResult[0].id;
    });

    afterEach(resetDB);

    it('should create a calendar draft with all required fields', async () => {
        const testInput: CreateCalendarDraftInput = {
            workspace_id: testWorkspaceId,
            title: 'Team Meeting',
            description: 'Weekly team sync',
            start_time: new Date('2024-01-15T10:00:00Z'),
            end_time: new Date('2024-01-15T11:00:00Z'),
            attendees: ['alice@example.com', 'bob@example.com']
        };

        const result = await createCalendarDraft(testInput);

        // Verify draft event properties
        expect(result.draft_event.id).toBeDefined();
        expect(result.draft_event.workspace_id).toEqual(testWorkspaceId);
        expect(result.draft_event.agent).toEqual('SchedulerAgent');
        expect(result.draft_event.action).toEqual('create_calendar_event');
        expect(result.draft_event.status).toEqual('awaiting_confirmation');
        expect(result.draft_event.output).toBeNull();
        expect(result.draft_event.created_at).toBeInstanceOf(Date);
        
        // Verify input is stored correctly (check key fields)
        const storedInput = result.draft_event.input as any;
        expect(storedInput.workspace_id).toEqual(testInput.workspace_id);
        expect(storedInput.title).toEqual(testInput.title);
        expect(storedInput.description).toEqual(testInput.description);
        expect(storedInput.attendees).toEqual(testInput.attendees);

        // Verify calendar event preview
        expect(result.calendar_event_preview.title).toEqual('Team Meeting');
        expect(result.calendar_event_preview.description).toEqual('Weekly team sync');
        expect(result.calendar_event_preview.start_time).toEqual(new Date('2024-01-15T10:00:00Z'));
        expect(result.calendar_event_preview.end_time).toEqual(new Date('2024-01-15T11:00:00Z'));
        expect(result.calendar_event_preview.attendees).toEqual(['alice@example.com', 'bob@example.com']);
    });

    it('should create a calendar draft with optional fields omitted', async () => {
        const testInput: CreateCalendarDraftInput = {
            workspace_id: testWorkspaceId,
            title: 'Simple Meeting',
            start_time: new Date('2024-01-20T14:00:00Z'),
            end_time: new Date('2024-01-20T15:00:00Z')
        };

        const result = await createCalendarDraft(testInput);

        // Verify draft event
        expect(result.draft_event.id).toBeDefined();
        expect(result.draft_event.workspace_id).toEqual(testWorkspaceId);
        expect(result.draft_event.agent).toEqual('SchedulerAgent');
        expect(result.draft_event.action).toEqual('create_calendar_event');
        expect(result.draft_event.status).toEqual('awaiting_confirmation');
        
        // Verify input is stored correctly
        const storedInput = result.draft_event.input as any;
        expect(storedInput.workspace_id).toEqual(testInput.workspace_id);
        expect(storedInput.title).toEqual(testInput.title);

        // Verify calendar event preview with optional fields
        expect(result.calendar_event_preview.title).toEqual('Simple Meeting');
        expect(result.calendar_event_preview.description).toBeUndefined();
        expect(result.calendar_event_preview.attendees).toBeUndefined();
        expect(result.calendar_event_preview.start_time).toEqual(new Date('2024-01-20T14:00:00Z'));
        expect(result.calendar_event_preview.end_time).toEqual(new Date('2024-01-20T15:00:00Z'));
    });

    it('should save agent event to database', async () => {
        const testInput: CreateCalendarDraftInput = {
            workspace_id: testWorkspaceId,
            title: 'Database Test Meeting',
            start_time: new Date('2024-01-25T09:00:00Z'),
            end_time: new Date('2024-01-25T10:30:00Z')
        };

        const result = await createCalendarDraft(testInput);

        // Query the database to verify the agent event was saved
        const agentEvents = await db.select()
            .from(agentEventsTable)
            .where(eq(agentEventsTable.id, result.draft_event.id))
            .execute();

        expect(agentEvents).toHaveLength(1);
        const savedEvent = agentEvents[0];
        expect(savedEvent.workspace_id).toEqual(testWorkspaceId);
        expect(savedEvent.agent).toEqual('SchedulerAgent');
        expect(savedEvent.action).toEqual('create_calendar_event');
        expect(savedEvent.status).toEqual('awaiting_confirmation');
        expect(savedEvent.output).toBeNull();
        expect(savedEvent.created_at).toBeInstanceOf(Date);
        
        // Verify input data is saved correctly
        const savedInput = savedEvent.input as any;
        expect(savedInput.workspace_id).toEqual(testInput.workspace_id);
        expect(savedInput.title).toEqual(testInput.title);
    });

    it('should handle complex calendar events with multiple attendees', async () => {
        const testInput: CreateCalendarDraftInput = {
            workspace_id: testWorkspaceId,
            title: 'Quarterly Review',
            description: 'Q4 performance review and planning for Q1',
            start_time: new Date('2024-02-01T13:00:00Z'),
            end_time: new Date('2024-02-01T16:00:00Z'),
            attendees: [
                'manager@example.com',
                'team-lead@example.com',
                'developer1@example.com',
                'developer2@example.com',
                'designer@example.com'
            ]
        };

        const result = await createCalendarDraft(testInput);

        // Verify all attendees are preserved in preview
        expect(result.calendar_event_preview.attendees).toHaveLength(5);
        expect(result.calendar_event_preview.attendees).toContain('manager@example.com');
        expect(result.calendar_event_preview.attendees).toContain('designer@example.com');

        // Verify the input is correctly stored in the agent event
        const storedInput = result.draft_event.input as any;
        expect(storedInput.attendees).toHaveLength(5);
        expect(storedInput.attendees).toContain('manager@example.com');
        expect(storedInput.title).toEqual('Quarterly Review');
    });

    it('should throw error for non-existent workspace', async () => {
        const testInput: CreateCalendarDraftInput = {
            workspace_id: 99999, // Non-existent workspace
            title: 'Invalid Meeting',
            start_time: new Date('2024-01-01T10:00:00Z'),
            end_time: new Date('2024-01-01T11:00:00Z')
        };

        await expect(createCalendarDraft(testInput)).rejects.toThrow();
    });
});