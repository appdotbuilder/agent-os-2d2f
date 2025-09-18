import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type AgentProposeInput } from '../schema';
import { agentPropose } from '../handlers/agent_propose';
import { eq } from 'drizzle-orm';

describe('agentPropose', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testWorkspaceId: number;

  beforeEach(async () => {
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
    testUserId = userResult[0].id;

    // Create test workspace
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

  const testInput: AgentProposeInput = {
    workspace_id: 0, // Will be set in tests
    agent: 'calendar_agent',
    action: 'create_event',
    input: {
      title: 'Team Meeting',
      start_time: '2024-01-15T10:00:00Z',
      end_time: '2024-01-15T11:00:00Z',
      attendees: ['john@example.com', 'jane@example.com']
    },
    rationale: 'Based on the discussion in the meeting notes, I detected a need to schedule a follow-up meeting with the team.'
  };

  it('should create agent proposal successfully', async () => {
    const input = { ...testInput, workspace_id: testWorkspaceId };
    const result = await agentPropose(input);

    // Validate response structure
    expect(result.agent_event).toBeDefined();
    expect(result.rationale).toEqual(input.rationale);

    // Validate agent event fields
    expect(result.agent_event.id).toBeDefined();
    expect(result.agent_event.workspace_id).toEqual(testWorkspaceId);
    expect(result.agent_event.agent).toEqual('calendar_agent');
    expect(result.agent_event.action).toEqual('create_event');
    expect(result.agent_event.input).toEqual(input.input);
    expect(result.agent_event.output).toBeNull();
    expect(result.agent_event.status).toEqual('awaiting_confirmation');
    expect(result.agent_event.created_at).toBeInstanceOf(Date);
  });

  it('should save agent event to database', async () => {
    const input = { ...testInput, workspace_id: testWorkspaceId };
    const result = await agentPropose(input);

    // Query database to verify the agent event was saved
    const agentEvents = await db.select()
      .from(agentEventsTable)
      .where(eq(agentEventsTable.id, result.agent_event.id))
      .execute();

    expect(agentEvents).toHaveLength(1);
    const savedEvent = agentEvents[0];
    
    expect(savedEvent.workspace_id).toEqual(testWorkspaceId);
    expect(savedEvent.agent).toEqual('calendar_agent');
    expect(savedEvent.action).toEqual('create_event');
    expect(savedEvent.input).toEqual(input.input);
    expect(savedEvent.output).toBeNull();
    expect(savedEvent.status).toEqual('awaiting_confirmation');
    expect(savedEvent.created_at).toBeInstanceOf(Date);
  });

  it('should handle different agent types and actions', async () => {
    const emailInput: AgentProposeInput = {
      workspace_id: testWorkspaceId,
      agent: 'email_agent',
      action: 'send_followup',
      input: {
        to: 'client@example.com',
        subject: 'Follow-up on meeting',
        template: 'meeting_followup'
      },
      rationale: 'Client requested follow-up information during the meeting.'
    };

    const result = await agentPropose(emailInput);

    expect(result.agent_event.agent).toEqual('email_agent');
    expect(result.agent_event.action).toEqual('send_followup');
    expect(result.agent_event.input).toEqual(emailInput.input);
    expect(result.rationale).toEqual(emailInput.rationale);
  });

  it('should handle complex input objects', async () => {
    const complexInput: AgentProposeInput = {
      workspace_id: testWorkspaceId,
      agent: 'task_agent',
      action: 'create_task_batch',
      input: {
        tasks: [
          {
            title: 'Prepare presentation',
            priority: 'high',
            due_date: '2024-01-20T09:00:00Z'
          },
          {
            title: 'Send meeting notes',
            priority: 'med',
            due_date: '2024-01-16T17:00:00Z'
          }
        ],
        assignee: 'john@example.com',
        project: 'Q1 Planning'
      },
      rationale: 'Identified multiple action items from the meeting that should be tracked as tasks.'
    };

    const result = await agentPropose(complexInput);

    expect(result.agent_event.input).toEqual(complexInput.input);
    expect((result.agent_event.input as any).tasks).toHaveLength(2);
    expect((result.agent_event.input as any).assignee).toEqual('john@example.com');
  });

  it('should throw error when workspace does not exist', async () => {
    const invalidInput = { ...testInput, workspace_id: 99999 };

    await expect(agentPropose(invalidInput)).rejects.toThrow(/workspace.*not found/i);
  });

  it('should preserve JSON input structure exactly', async () => {
    const inputWithNestedObjects: AgentProposeInput = {
      workspace_id: testWorkspaceId,
      agent: 'integration_agent',
      action: 'sync_data',
      input: {
        source: 'google_calendar',
        filters: {
          date_range: {
            start: '2024-01-01',
            end: '2024-01-31'
          },
          attendees: ['team@company.com']
        },
        options: {
          include_private: false,
          sync_reminders: true
        }
      },
      rationale: 'User requested calendar sync for January planning.'
    };

    const result = await agentPropose(inputWithNestedObjects);

    // Verify nested structure is preserved
    const inputData = result.agent_event.input as any;
    expect(inputData.source).toEqual('google_calendar');
    expect(inputData.filters.date_range.start).toEqual('2024-01-01');
    expect(inputData.filters.attendees).toEqual(['team@company.com']);
    expect(inputData.options.include_private).toEqual(false);
    expect(inputData.options.sync_reminders).toEqual(true);
  });
});