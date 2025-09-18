import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable } from '../db/schema';
import { getTasks } from '../handlers/get_tasks';
import { eq } from 'drizzle-orm';

describe('getTasks', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for workspace with no tasks', async () => {
    // Create user and workspace
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();

    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const result = await getTasks(workspace.id);
    expect(result).toEqual([]);
  });

  it('should return all tasks for a workspace', async () => {
    // Create user and workspace
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();

    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create test tasks
    const dueDate = new Date('2024-12-31T23:59:59Z');
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspace.id,
          title: 'Task 1',
          description: 'First task',
          status: 'todo',
          priority: 'high',
          due_at: dueDate,
          assignee_id: user.id
        },
        {
          workspace_id: workspace.id,
          title: 'Task 2',
          description: null,
          status: 'doing',
          priority: 'med',
          due_at: null,
          assignee_id: null
        },
        {
          workspace_id: workspace.id,
          title: 'Task 3',
          status: 'done',
          priority: 'low'
        }
      ])
      .execute();

    const result = await getTasks(workspace.id);

    expect(result).toHaveLength(3);
    
    // Verify first task
    const task1 = result.find(t => t.title === 'Task 1');
    expect(task1).toBeDefined();
    expect(task1!.workspace_id).toBe(workspace.id);
    expect(task1!.description).toBe('First task');
    expect(task1!.status).toBe('todo');
    expect(task1!.priority).toBe('high');
    expect(task1!.due_at).toEqual(dueDate);
    expect(task1!.assignee_id).toBe(user.id);
    expect(task1!.created_at).toBeInstanceOf(Date);
    expect(task1!.updated_at).toBeInstanceOf(Date);

    // Verify second task (with nulls)
    const task2 = result.find(t => t.title === 'Task 2');
    expect(task2).toBeDefined();
    expect(task2!.description).toBeNull();
    expect(task2!.status).toBe('doing');
    expect(task2!.priority).toBe('med');
    expect(task2!.due_at).toBeNull();
    expect(task2!.assignee_id).toBeNull();

    // Verify third task (with defaults)
    const task3 = result.find(t => t.title === 'Task 3');
    expect(task3).toBeDefined();
    expect(task3!.status).toBe('done');
    expect(task3!.priority).toBe('low');
  });

  it('should only return tasks for the specified workspace', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();

    // Create two workspaces
    const [workspace1] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Workspace 1',
        settings: {}
      })
      .returning()
      .execute();

    const [workspace2] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Workspace 2',
        settings: {}
      })
      .returning()
      .execute();

    // Create tasks in both workspaces
    await db.insert(tasksTable)
      .values([
        {
          workspace_id: workspace1.id,
          title: 'Workspace 1 Task',
          status: 'todo',
          priority: 'med'
        },
        {
          workspace_id: workspace2.id,
          title: 'Workspace 2 Task',
          status: 'done',
          priority: 'high'
        }
      ])
      .execute();

    // Get tasks for workspace 1
    const result1 = await getTasks(workspace1.id);
    expect(result1).toHaveLength(1);
    expect(result1[0].title).toBe('Workspace 1 Task');
    expect(result1[0].workspace_id).toBe(workspace1.id);

    // Get tasks for workspace 2
    const result2 = await getTasks(workspace2.id);
    expect(result2).toHaveLength(1);
    expect(result2[0].title).toBe('Workspace 2 Task');
    expect(result2[0].workspace_id).toBe(workspace2.id);
  });

  it('should handle date conversion correctly', async () => {
    // Create user and workspace
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();

    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create a task with specific dates
    const specificDate = new Date('2024-01-15T10:30:00Z');
    await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Date Test Task',
        status: 'todo',
        priority: 'med',
        due_at: specificDate
      })
      .execute();

    const result = await getTasks(workspace.id);
    
    expect(result).toHaveLength(1);
    expect(result[0].due_at).toBeInstanceOf(Date);
    expect(result[0].due_at).toEqual(specificDate);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should verify tasks are saved in database correctly', async () => {
    // Create user and workspace
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        display_name: 'Test User',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();

    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create task via handler test
    await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Database Verification Task',
        description: 'Testing database storage',
        status: 'todo',
        priority: 'high'
      })
      .execute();

    // Verify with handler
    const handlerResult = await getTasks(workspace.id);
    expect(handlerResult).toHaveLength(1);

    // Verify directly in database
    const dbResult = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.workspace_id, workspace.id))
      .execute();

    expect(dbResult).toHaveLength(1);
    expect(dbResult[0].title).toBe('Database Verification Task');
    expect(dbResult[0].description).toBe('Testing database storage');
    expect(dbResult[0].status).toBe('todo');
    expect(dbResult[0].priority).toBe('high');
  });
});