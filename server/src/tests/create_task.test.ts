import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tasksTable, usersTable, workspacesTable, notesTable } from '../db/schema';
import { type CreateTaskInput } from '../schema';
import { createTask } from '../handlers/create_task';
import { eq } from 'drizzle-orm';

describe('createTask', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testWorkspaceId: number;
  let testNoteId: number;

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

    // Create test note for linking
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: testWorkspaceId,
        title: 'Test Note',
        source: 'manual',
        content_md: '# Test Note Content',
        entities: {},
        created_by: testUserId
      })
      .returning()
      .execute();
    testNoteId = noteResult[0].id;
  });

  it('should create a task with minimal required fields', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Test Task'
    };

    const result = await createTask(testInput);

    // Basic field validation
    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.title).toEqual('Test Task');
    expect(result.description).toBeNull();
    expect(result.status).toEqual('todo'); // Default value
    expect(result.priority).toEqual('med'); // Default value
    expect(result.due_at).toBeNull();
    expect(result.assignee_id).toBeNull();
    expect(result.linked_note_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a task with all optional fields', async () => {
    const dueDate = new Date('2024-12-31T23:59:59Z');
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Comprehensive Test Task',
      description: 'This is a detailed task description',
      status: 'doing',
      priority: 'high',
      due_at: dueDate,
      assignee_id: testUserId,
      linked_note_id: testNoteId
    };

    const result = await createTask(testInput);

    expect(result.workspace_id).toEqual(testWorkspaceId);
    expect(result.title).toEqual('Comprehensive Test Task');
    expect(result.description).toEqual('This is a detailed task description');
    expect(result.status).toEqual('doing');
    expect(result.priority).toEqual('high');
    expect(result.due_at).toEqual(dueDate);
    expect(result.assignee_id).toEqual(testUserId);
    expect(result.linked_note_id).toEqual(testNoteId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save task to database', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Database Test Task',
      description: 'Testing database persistence',
      status: 'done',
      priority: 'low'
    };

    const result = await createTask(testInput);

    // Query database to verify task was saved
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, result.id))
      .execute();

    expect(tasks).toHaveLength(1);
    const savedTask = tasks[0];
    expect(savedTask.workspace_id).toEqual(testWorkspaceId);
    expect(savedTask.title).toEqual('Database Test Task');
    expect(savedTask.description).toEqual('Testing database persistence');
    expect(savedTask.status).toEqual('done');
    expect(savedTask.priority).toEqual('low');
    expect(savedTask.created_at).toBeInstanceOf(Date);
    expect(savedTask.updated_at).toBeInstanceOf(Date);
  });

  it('should handle null values for optional fields', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Null Fields Task',
      description: null,
      due_at: null,
      assignee_id: null,
      linked_note_id: null
    };

    const result = await createTask(testInput);

    expect(result.description).toBeNull();
    expect(result.due_at).toBeNull();
    expect(result.assignee_id).toBeNull();
    expect(result.linked_note_id).toBeNull();
  });

  it('should throw error for invalid workspace_id', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: 99999, // Non-existent workspace
      title: 'Invalid Workspace Task'
    };

    await expect(createTask(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should throw error for invalid assignee_id', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Invalid Assignee Task',
      assignee_id: 99999 // Non-existent user
    };

    await expect(createTask(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should throw error for invalid linked_note_id', async () => {
    const testInput: CreateTaskInput = {
      workspace_id: testWorkspaceId,
      title: 'Invalid Note Link Task',
      linked_note_id: 99999 // Non-existent note
    };

    await expect(createTask(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });
});