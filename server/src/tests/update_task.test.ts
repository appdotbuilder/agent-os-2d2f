import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, notesTable } from '../db/schema';
import { type UpdateTaskInput, type CreateUserInput, type CreateWorkspaceInput, type CreateTaskInput, type CreateNoteInput } from '../schema';
import { updateTask } from '../handlers/update_task';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

const testWorkspace: CreateWorkspaceInput = {
  owner_id: 1, // Will be set after user creation
  name: 'Test Workspace',
  settings: { theme: 'dark' }
};

const testTask: CreateTaskInput = {
  workspace_id: 1, // Will be set after workspace creation
  title: 'Original Task',
  description: 'Original description',
  status: 'todo',
  priority: 'low',
  due_at: new Date('2024-12-31'),
  assignee_id: null,
  linked_note_id: null
};

const testNote: CreateNoteInput = {
  workspace_id: 1, // Will be set after workspace creation
  title: 'Test Note',
  source: 'manual',
  content_md: '# Test Note',
  created_by: 1
};

describe('updateTask', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let workspaceId: number;
  let taskId: number;
  let noteId: number;

  beforeEach(async () => {
    // Create prerequisite user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create prerequisite workspace
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: testWorkspace.name,
        settings: testWorkspace.settings || {}
      })
      .returning()
      .execute();
    workspaceId = workspaceResult[0].id;

    // Create prerequisite note for linking tests
    const noteResult = await db.insert(notesTable)
      .values({
        ...testNote,
        workspace_id: workspaceId,
        created_by: userId,
        entities: {}
      })
      .returning()
      .execute();
    noteId = noteResult[0].id;

    // Create prerequisite task
    const taskResult = await db.insert(tasksTable)
      .values({
        ...testTask,
        workspace_id: workspaceId
      })
      .returning()
      .execute();
    taskId = taskResult[0].id;
  });

  it('should update a task with all fields', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Updated Task',
      description: 'Updated description',
      status: 'doing',
      priority: 'high',
      due_at: new Date('2024-11-30'),
      assignee_id: userId,
      linked_note_id: noteId
    };

    const result = await updateTask(updateInput);

    expect(result.id).toEqual(taskId);
    expect(result.title).toEqual('Updated Task');
    expect(result.description).toEqual('Updated description');
    expect(result.status).toEqual('doing');
    expect(result.priority).toEqual('high');
    expect(result.due_at).toEqual(new Date('2024-11-30'));
    expect(result.assignee_id).toEqual(userId);
    expect(result.linked_note_id).toEqual(noteId);
    expect(result.workspace_id).toEqual(workspaceId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Only Title Updated',
      status: 'done'
    };

    const result = await updateTask(updateInput);

    // Updated fields
    expect(result.title).toEqual('Only Title Updated');
    expect(result.status).toEqual('done');

    // Unchanged fields should retain original values
    expect(result.description).toEqual('Original description');
    expect(result.priority).toEqual('low');
    expect(result.due_at).toEqual(new Date('2024-12-31'));
    expect(result.assignee_id).toBeNull();
    expect(result.linked_note_id).toBeNull();
  });

  it('should update task in database', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Database Update Test',
      priority: 'high'
    };

    await updateTask(updateInput);

    // Verify changes were persisted to database
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toEqual('Database Update Test');
    expect(tasks[0].priority).toEqual('high');
    expect(tasks[0].updated_at).toBeInstanceOf(Date);
  });

  it('should set nullable fields to null', async () => {
    // First update to set some values
    await updateTask({
      id: taskId,
      description: 'Test description',
      assignee_id: userId,
      linked_note_id: noteId
    });

    // Then update to set them to null
    const updateInput: UpdateTaskInput = {
      id: taskId,
      description: null,
      assignee_id: null,
      linked_note_id: null
    };

    const result = await updateTask(updateInput);

    expect(result.description).toBeNull();
    expect(result.assignee_id).toBeNull();
    expect(result.linked_note_id).toBeNull();
  });

  it('should update the updated_at timestamp', async () => {
    const originalTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    const originalUpdatedAt = originalTask[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Timestamp Test'
    };

    const result = await updateTask(updateInput);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('should throw error for non-existent task', async () => {
    const updateInput: UpdateTaskInput = {
      id: 99999,
      title: 'Non-existent Task'
    };

    await expect(updateTask(updateInput)).rejects.toThrow(/Task with id 99999 not found/i);
  });

  it('should handle foreign key references correctly', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      assignee_id: userId,
      linked_note_id: noteId
    };

    const result = await updateTask(updateInput);

    expect(result.assignee_id).toEqual(userId);
    expect(result.linked_note_id).toEqual(noteId);

    // Verify foreign key relationships are maintained in database
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(tasks[0].assignee_id).toEqual(userId);
    expect(tasks[0].linked_note_id).toEqual(noteId);
  });

  it('should handle due_at date updates correctly', async () => {
    const futureDate = new Date('2025-06-15T10:30:00Z');
    const updateInput: UpdateTaskInput = {
      id: taskId,
      due_at: futureDate
    };

    const result = await updateTask(updateInput);

    expect(result.due_at).toBeInstanceOf(Date);
    expect(result.due_at?.getTime()).toEqual(futureDate.getTime());

    // Test setting due_at to null
    const nullDateInput: UpdateTaskInput = {
      id: taskId,
      due_at: null
    };

    const nullResult = await updateTask(nullDateInput);
    expect(nullResult.due_at).toBeNull();
  });
});