import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, agentEventsTable } from '../db/schema';
import { type CreateUserInput, type CreateWorkspaceInput, type CreateAgentEventInput } from '../schema';
import { getAgentEvents } from '../handlers/get_agent_events';

// Test data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

const testWorkspace = {
  owner_id: 1,
  name: 'Test Workspace',
  settings: { theme: 'dark' }
};

const testAgentEvent: CreateAgentEventInput = {
  workspace_id: 1,
  agent: 'calendar-agent',
  action: 'create_event',
  input: { title: 'Test Meeting', time: '2024-01-01T10:00:00Z' },
  output: { event_id: 'evt_123' },
  status: 'draft'
};

describe('getAgentEvents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no agent events exist', async () => {
    // Create user and workspace first
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(workspacesTable).values(testWorkspace).execute();

    const result = await getAgentEvents(1);

    expect(result).toEqual([]);
  });

  it('should return agent events for workspace ordered by created_at desc', async () => {
    // Create user and workspace
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(workspacesTable).values(testWorkspace).execute();

    // Create multiple agent events with different timestamps
    const event1 = {
      ...testAgentEvent,
      agent: 'agent-1',
      action: 'action-1',
      status: 'draft' as const
    };
    
    const event2 = {
      ...testAgentEvent,
      agent: 'agent-2',
      action: 'action-2',
      status: 'executed' as const
    };

    const event3 = {
      ...testAgentEvent,
      agent: 'agent-3',
      action: 'action-3',
      status: 'awaiting_confirmation' as const
    };

    // Insert events with small delays to ensure different timestamps
    await db.insert(agentEventsTable).values(event1).execute();
    await new Promise(resolve => setTimeout(resolve, 10));
    await db.insert(agentEventsTable).values(event2).execute();
    await new Promise(resolve => setTimeout(resolve, 10));
    await db.insert(agentEventsTable).values(event3).execute();

    const result = await getAgentEvents(1);

    expect(result).toHaveLength(3);
    // Should be ordered by created_at desc (most recent first)
    expect(result[0].agent).toBe('agent-3');
    expect(result[1].agent).toBe('agent-2');
    expect(result[2].agent).toBe('agent-1');
    
    // Verify all fields are present
    result.forEach(event => {
      expect(event.id).toBeDefined();
      expect(event.workspace_id).toBe(1);
      expect(event.agent).toBeDefined();
      expect(event.action).toBeDefined();
      expect(event.input).toBeDefined();
      expect(event.output).toBeDefined();
      expect(event.status).toBeDefined();
      expect(event.created_at).toBeInstanceOf(Date);
    });
  });

  it('should filter by status when provided', async () => {
    // Create user and workspace
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(workspacesTable).values(testWorkspace).execute();

    // Create events with different statuses
    const draftEvent = {
      ...testAgentEvent,
      agent: 'draft-agent',
      status: 'draft' as const
    };
    
    const executedEvent = {
      ...testAgentEvent,
      agent: 'executed-agent',
      status: 'executed' as const
    };

    const awaitingEvent = {
      ...testAgentEvent,
      agent: 'awaiting-agent',
      status: 'awaiting_confirmation' as const
    };

    await db.insert(agentEventsTable).values([draftEvent, executedEvent, awaitingEvent]).execute();

    // Test filtering by 'awaiting_confirmation'
    const awaitingResult = await getAgentEvents(1, 'awaiting_confirmation');
    expect(awaitingResult).toHaveLength(1);
    expect(awaitingResult[0].agent).toBe('awaiting-agent');
    expect(awaitingResult[0].status).toBe('awaiting_confirmation');

    // Test filtering by 'draft'
    const draftResult = await getAgentEvents(1, 'draft');
    expect(draftResult).toHaveLength(1);
    expect(draftResult[0].agent).toBe('draft-agent');
    expect(draftResult[0].status).toBe('draft');

    // Test filtering by 'executed'
    const executedResult = await getAgentEvents(1, 'executed');
    expect(executedResult).toHaveLength(1);
    expect(executedResult[0].agent).toBe('executed-agent');
    expect(executedResult[0].status).toBe('executed');
  });

  it('should only return events for the specified workspace', async () => {
    // Create user and two workspaces
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(workspacesTable).values([
      testWorkspace,
      { owner_id: 1, name: 'Workspace 2', settings: { theme: 'light' } }
    ]).execute();

    // Create events in different workspaces
    const workspace1Event = {
      ...testAgentEvent,
      workspace_id: 1,
      agent: 'workspace-1-agent'
    };
    
    const workspace2Event = {
      ...testAgentEvent,
      workspace_id: 2,
      agent: 'workspace-2-agent'
    };

    await db.insert(agentEventsTable).values([workspace1Event, workspace2Event]).execute();

    // Get events for workspace 1
    const workspace1Result = await getAgentEvents(1);
    expect(workspace1Result).toHaveLength(1);
    expect(workspace1Result[0].workspace_id).toBe(1);
    expect(workspace1Result[0].agent).toBe('workspace-1-agent');

    // Get events for workspace 2
    const workspace2Result = await getAgentEvents(2);
    expect(workspace2Result).toHaveLength(1);
    expect(workspace2Result[0].workspace_id).toBe(2);
    expect(workspace2Result[0].agent).toBe('workspace-2-agent');
  });

  it('should handle workspace with no events', async () => {
    // Create user and workspace
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(workspacesTable).values(testWorkspace).execute();

    const result = await getAgentEvents(999); // Non-existent workspace

    expect(result).toEqual([]);
  });

  it('should handle error status filter', async () => {
    // Create user and workspace
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(workspacesTable).values(testWorkspace).execute();

    // Create event with error status
    const errorEvent = {
      ...testAgentEvent,
      agent: 'error-agent',
      status: 'error' as const,
      output: { error: 'Something went wrong' }
    };

    await db.insert(agentEventsTable).values(errorEvent).execute();

    const result = await getAgentEvents(1, 'error');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('error');
    expect(result[0].agent).toBe('error-agent');
  });

  it('should handle complex input and output JSON objects', async () => {
    // Create user and workspace
    await db.insert(usersTable).values(testUser).execute();
    await db.insert(workspacesTable).values(testWorkspace).execute();

    // Create event with complex JSON data
    const complexEvent = {
      ...testAgentEvent,
      input: {
        type: 'calendar',
        data: {
          title: 'Complex Meeting',
          attendees: ['user1@example.com', 'user2@example.com'],
          metadata: { priority: 'high', tags: ['important', 'urgent'] }
        }
      },
      output: {
        success: true,
        result: {
          event_id: 'evt_complex_123',
          created_at: '2024-01-01T10:00:00Z',
          notifications_sent: 2
        }
      }
    };

    await db.insert(agentEventsTable).values(complexEvent).execute();

    const result = await getAgentEvents(1);
    expect(result).toHaveLength(1);
    
    // Verify complex JSON objects are preserved
    expect(result[0].input).toEqual(complexEvent.input);
    expect(result[0].output).toEqual(complexEvent.output);
    expect(typeof result[0].input).toBe('object');
    expect(typeof result[0].output).toBe('object');
  });
});