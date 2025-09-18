import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, remindersTable } from '../db/schema';
import { getUpcomingReminders } from '../handlers/get_upcoming_reminders';

describe('getUpcomingReminders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch upcoming reminders for a workspace', async () => {
    // Create test user
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

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create test task
    const [task] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Test Task',
        description: 'A task for testing',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create upcoming reminder
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    const [reminder] = await db.insert(remindersTable)
      .values({
        task_id: task.id,
        remind_at: futureDate,
        method: 'email',
        status: 'scheduled'
      })
      .returning()
      .execute();

    const results = await getUpcomingReminders(workspace.id);

    expect(results).toHaveLength(1);
    expect(results[0].id).toEqual(reminder.id);
    expect(results[0].task_id).toEqual(task.id);
    expect(results[0].method).toEqual('email');
    expect(results[0].status).toEqual('scheduled');
    expect(results[0].remind_at).toBeInstanceOf(Date);
  });

  it('should not include past reminders', async () => {
    // Create test user
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

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create test task
    const [task] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Test Task',
        description: 'A task for testing',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create past reminder
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 2);

    await db.insert(remindersTable)
      .values({
        task_id: task.id,
        remind_at: pastDate,
        method: 'email',
        status: 'scheduled'
      })
      .execute();

    const results = await getUpcomingReminders(workspace.id);

    expect(results).toHaveLength(0);
  });

  it('should not include non-scheduled reminders', async () => {
    // Create test user
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

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create test task
    const [task] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Test Task',
        description: 'A task for testing',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create future reminder with 'sent' status
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    await db.insert(remindersTable)
      .values({
        task_id: task.id,
        remind_at: futureDate,
        method: 'email',
        status: 'sent'
      })
      .execute();

    const results = await getUpcomingReminders(workspace.id);

    expect(results).toHaveLength(0);
  });

  it('should only include reminders for the specified workspace', async () => {
    // Create test users
    const [user1] = await db.insert(usersTable)
      .values({
        email: 'test1@example.com',
        display_name: 'Test User 1',
        timezone: 'UTC',
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      })
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        email: 'test2@example.com',
        display_name: 'Test User 2',
        timezone: 'UTC',
        llm_provider: 'anthropic',
        llm_model: 'claude-3'
      })
      .returning()
      .execute();

    // Create test workspaces
    const [workspace1] = await db.insert(workspacesTable)
      .values({
        owner_id: user1.id,
        name: 'Test Workspace 1',
        settings: {}
      })
      .returning()
      .execute();

    const [workspace2] = await db.insert(workspacesTable)
      .values({
        owner_id: user2.id,
        name: 'Test Workspace 2',
        settings: {}
      })
      .returning()
      .execute();

    // Create tasks in different workspaces
    const [task1] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace1.id,
        title: 'Task in Workspace 1',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    const [task2] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace2.id,
        title: 'Task in Workspace 2',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create future reminders for both tasks
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2);

    await db.insert(remindersTable)
      .values({
        task_id: task1.id,
        remind_at: futureDate,
        method: 'email',
        status: 'scheduled'
      })
      .execute();

    await db.insert(remindersTable)
      .values({
        task_id: task2.id,
        remind_at: futureDate,
        method: 'app_push',
        status: 'scheduled'
      })
      .execute();

    // Should only return reminder for workspace 1
    const results = await getUpcomingReminders(workspace1.id);

    expect(results).toHaveLength(1);
    expect(results[0].task_id).toEqual(task1.id);
    expect(results[0].method).toEqual('email');
  });

  it('should order reminders by remind_at ascending', async () => {
    // Create test user
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

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create test task
    const [task] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Test Task',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create reminders at different times
    const now = new Date();
    const futureDate1 = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour from now
    const futureDate2 = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const futureDate3 = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

    await db.insert(remindersTable)
      .values([
        {
          task_id: task.id,
          remind_at: futureDate1,
          method: 'email',
          status: 'scheduled'
        },
        {
          task_id: task.id,
          remind_at: futureDate2,
          method: 'app_push',
          status: 'scheduled'
        },
        {
          task_id: task.id,
          remind_at: futureDate3,
          method: 'calendar',
          status: 'scheduled'
        }
      ])
      .execute();

    const results = await getUpcomingReminders(workspace.id);

    expect(results).toHaveLength(3);
    expect(results[0].method).toEqual('calendar'); // 30 minutes from now
    expect(results[1].method).toEqual('email'); // 1 hour from now
    expect(results[2].method).toEqual('app_push'); // 2 hours from now
    
    // Verify ordering
    expect(results[0].remind_at.getTime()).toBeLessThan(results[1].remind_at.getTime());
    expect(results[1].remind_at.getTime()).toBeLessThan(results[2].remind_at.getTime());
  });

  it('should respect the limit parameter', async () => {
    // Create test user
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

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create test task
    const [task] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Test Task',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create 5 future reminders
    const reminders = [];
    for (let i = 1; i <= 5; i++) {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + i);
      
      reminders.push({
        task_id: task.id,
        remind_at: futureDate,
        method: 'email' as const,
        status: 'scheduled' as const
      });
    }

    await db.insert(remindersTable)
      .values(reminders)
      .execute();

    // Test with limit of 2
    const results = await getUpcomingReminders(workspace.id, 2);

    expect(results).toHaveLength(2);
  });

  it('should use default limit of 10 when no limit specified', async () => {
    // Create test user
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

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    // Create test task
    const [task] = await db.insert(tasksTable)
      .values({
        workspace_id: workspace.id,
        title: 'Test Task',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();

    // Create 15 future reminders
    const reminders = [];
    for (let i = 1; i <= 15; i++) {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + i);
      
      reminders.push({
        task_id: task.id,
        remind_at: futureDate,
        method: 'email' as const,
        status: 'scheduled' as const
      });
    }

    await db.insert(remindersTable)
      .values(reminders)
      .execute();

    // Test without limit parameter (should default to 10)
    const results = await getUpcomingReminders(workspace.id);

    expect(results).toHaveLength(10);
  });

  it('should return empty array when no upcoming reminders exist', async () => {
    // Create test user
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

    // Create test workspace
    const [workspace] = await db.insert(workspacesTable)
      .values({
        owner_id: user.id,
        name: 'Test Workspace',
        settings: {}
      })
      .returning()
      .execute();

    const results = await getUpcomingReminders(workspace.id);

    expect(results).toHaveLength(0);
  });
});