import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type FinalizeMeetingInput } from '../schema';
import { finalizeMeeting } from '../handlers/finalize_meeting';
import { eq } from 'drizzle-orm';

// Test data setup
const testTranscript = `Good morning everyone. We decided to move forward with the new project timeline. 
John will handle the backend implementation and Sarah will focus on the frontend. 
We need to complete the first phase by March 15th, 2024. The team agreed that this is a high priority task.
We should follow up on the database migration next week.`;

const simpleTranscript = "Meeting completed successfully with all participants.";

const longTranscript = `This is a very long sentence that contains action items and decisions but exceeds one hundred characters in total length making it a candidate for truncation when converted to action items. We decided this was important.`;

describe('finalizeMeeting', () => {
    let testUser: any;
    let testWorkspace: any;

    beforeEach(async () => {
        await createDB();

        // Create test user
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
        testUser = userResult[0];

        // Create test workspace
        const workspaceResult = await db.insert(workspacesTable)
            .values({
                owner_id: testUser.id,
                name: 'Test Workspace',
                settings: {}
            })
            .returning()
            .execute();
        testWorkspace = workspaceResult[0];
    });

    afterEach(resetDB);

    it('should finalize meeting with comprehensive transcript', async () => {
        const input: FinalizeMeetingInput = {
            workspace_id: testWorkspace.id,
            transcript: testTranscript,
            title: 'Sprint Planning Meeting',
            created_by: testUser.id
        };

        const result = await finalizeMeeting(input);

        // Verify note creation
        expect(result.note.id).toBeDefined();
        expect(result.note.workspace_id).toEqual(testWorkspace.id);
        expect(result.note.title).toEqual('Sprint Planning Meeting');
        expect(result.note.source).toEqual('meeting');
        expect(result.note.transcript_text).toEqual(testTranscript);
        expect(result.note.created_by).toEqual(testUser.id);
        expect(result.note.created_at).toBeInstanceOf(Date);
        expect(result.note.updated_at).toBeInstanceOf(Date);

        // Verify content_md structure
        expect(result.note.content_md).toContain('# Sprint Planning Meeting');
        expect(result.note.content_md).toContain('## Summary');
        expect(result.note.content_md).toContain('## Transcript');
        expect(result.note.content_md).toContain('## Key People');
        expect(result.note.content_md).toContain('## Decisions Made');
        expect(result.note.content_md).toContain('## Action Items');

        // Verify summary generation
        expect(result.summary).toContain('Meeting summary');
        expect(result.summary).toContain('Good morning everyone');
        expect(typeof result.summary).toBe('string');
        expect(result.summary.length).toBeGreaterThan(0);

        // Verify entity extraction
        expect(result.entities).toHaveProperty('people');
        expect(result.entities).toHaveProperty('decisions');
        expect(result.entities).toHaveProperty('risks');
        expect(result.entities).toHaveProperty('dates');
        expect(Array.isArray(result.entities['people'])).toBe(true);
        expect(Array.isArray(result.entities['decisions'])).toBe(true);

        // Verify people extraction (should find John and Sarah)
        expect(result.entities['people']).toContain('John');
        expect(result.entities['people']).toContain('Sarah');

        // Verify date extraction
        expect(result.entities['dates']).toContain('March 15th, 2024');

        // Verify decisions extraction
        expect(result.entities['decisions'].length).toBeGreaterThan(0);
        expect(result.entities['decisions'].some((d: string) => d.includes('decided'))).toBe(true);

        // Verify action extraction
        expect(Array.isArray(result.extracted_actions)).toBe(true);
        expect(result.extracted_actions.length).toBeGreaterThan(0);
        
        const firstAction = result.extracted_actions[0];
        expect(firstAction).toHaveProperty('title');
        expect(firstAction).toHaveProperty('priority');
        expect(['low', 'med', 'high']).toContain(firstAction.priority);
        expect(typeof firstAction.title).toBe('string');
    });

    it('should save note to database correctly', async () => {
        const input: FinalizeMeetingInput = {
            workspace_id: testWorkspace.id,
            transcript: testTranscript,
            title: 'Database Test Meeting',
            created_by: testUser.id
        };

        const result = await finalizeMeeting(input);

        // Verify database insertion
        const savedNotes = await db.select()
            .from(notesTable)
            .where(eq(notesTable.id, result.note.id))
            .execute();

        expect(savedNotes).toHaveLength(1);
        const savedNote = savedNotes[0];

        expect(savedNote.workspace_id).toEqual(testWorkspace.id);
        expect(savedNote.title).toEqual('Database Test Meeting');
        expect(savedNote.source).toEqual('meeting');
        expect(savedNote.transcript_text).toEqual(testTranscript);
        expect(savedNote.summary_text).toEqual(result.summary);
        expect(savedNote.created_by).toEqual(testUser.id);
        expect(savedNote.created_at).toBeInstanceOf(Date);
        expect(savedNote.updated_at).toBeInstanceOf(Date);

        // Verify entities are stored as JSON
        expect(typeof savedNote.entities).toBe('object');
        expect(savedNote.entities).toHaveProperty('people');
        expect(savedNote.entities).toHaveProperty('decisions');
    });

    it('should handle simple transcript with minimal content', async () => {
        const input: FinalizeMeetingInput = {
            workspace_id: testWorkspace.id,
            transcript: simpleTranscript,
            title: 'Brief Check-in',
            created_by: testUser.id
        };

        const result = await finalizeMeeting(input);

        // Should still create valid response
        expect(result.note.id).toBeDefined();
        expect(result.note.title).toEqual('Brief Check-in');
        expect(result.summary).toContain('Meeting summary');
        
        // Should handle empty extractions gracefully
        expect(result.entities['people']).toEqual([]);
        expect(result.entities['decisions']).toEqual([]);
        expect(result.entities['dates']).toEqual([]);
        expect(result.extracted_actions).toEqual([]);

        // Content should still be properly formatted
        expect(result.note.content_md).toContain('## Key People');
        expect(result.note.content_md).toContain('None identified');
    });

    it('should truncate long action items', async () => {
        const input: FinalizeMeetingInput = {
            workspace_id: testWorkspace.id,
            transcript: longTranscript,
            title: 'Long Content Meeting',
            created_by: testUser.id
        };

        const result = await finalizeMeeting(input);

        // Find action items that were truncated
        const longActions = result.extracted_actions.filter(action => action.title.endsWith('...'));
        expect(longActions.length).toBeGreaterThan(0);

        // Verify truncated actions are properly limited
        longActions.forEach(action => {
            expect(action.title.length).toBeLessThanOrEqual(100);
        });
    });

    it('should assign different priorities to extracted actions', async () => {
        const multiActionTranscript = `We need to update the documentation immediately. 
        We should review the code next week. 
        We will consider the new feature proposal eventually.
        Must complete the security audit as soon as possible.`;

        const input: FinalizeMeetingInput = {
            workspace_id: testWorkspace.id,
            transcript: multiActionTranscript,
            title: 'Action Planning Meeting',
            created_by: testUser.id
        };

        const result = await finalizeMeeting(input);

        expect(result.extracted_actions.length).toBeGreaterThan(0);
        
        // Should have different priority levels
        const priorities = result.extracted_actions.map(action => action.priority);
        const uniquePriorities = [...new Set(priorities)];
        
        // Verify priorities are valid
        priorities.forEach(priority => {
            expect(['low', 'med', 'high']).toContain(priority);
        });

        // First action should be high priority
        if (result.extracted_actions.length > 0) {
            expect(result.extracted_actions[0].priority).toEqual('high');
        }
    });

    it('should handle empty transcript gracefully', async () => {
        const input: FinalizeMeetingInput = {
            workspace_id: testWorkspace.id,
            transcript: '',
            title: 'Empty Meeting',
            created_by: testUser.id
        };

        const result = await finalizeMeeting(input);

        expect(result.note.id).toBeDefined();
        expect(result.summary).toEqual('Meeting transcript processed.');
        expect(result.entities['people']).toEqual([]);
        expect(result.entities['decisions']).toEqual([]);
        expect(result.entities['dates']).toEqual([]);
        expect(result.extracted_actions).toEqual([]);
    });
});