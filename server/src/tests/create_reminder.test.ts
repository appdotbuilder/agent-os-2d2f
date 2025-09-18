import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, tasksTable, remindersTable } from '../db/schema';
import { type CreateReminderInput } from '../schema';
import { createReminder } from '../handlers/create_reminder';
import { eq } from 'drizzle-orm';

describe('createReminder', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testWorkspaceId: number;
  let testTaskId: number;

  beforeEach(async () => {
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

    // Create prerequisite task
    const taskResult = await db.insert(tasksTable)
      .values({
        workspace_id: testWorkspaceId,
        title: 'Test Task',
        description: 'A task for testing reminders',
        status: 'todo',
        priority: 'med'
      })
      .returning()
      .execute();
    testTaskId = taskResult[0].id;
  });

  it('should create a reminder with all fields provided', async () => {
    const remindAt = new Date('2024-12-25T10:00:00Z');
    const testInput: CreateReminderInput = {
      task_id: testTaskId,
      remind_at: remindAt,
      method: 'email',
      status: 'scheduled'
    };

    const result = await createReminder(testInput);

    // Basic field validation
    expect(result.task_id).toEqual(testTaskId);
    expect(result.remind_at).toEqual(remindAt);
    expect(result.method).toEqual('email');
    expect(result.status).toEqual('scheduled');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a reminder with default status when not provided', async () => {
    const remindAt = new Date('2024-12-25T15:30:00Z');
    const testInput: CreateReminderInput = {
      task_id: testTaskId,
      remind_at: remindAt,
      method: 'app_push'
    };

    const result = await createReminder(testInput);

    // Verify default status is applied
    expect(result.status).toEqual('scheduled');
    expect(result.task_id).toEqual(testTaskId);
    expect(result.remind_at).toEqual(remindAt);
    expect(result.method).toEqual('app_push');
    expect(result.id).toBeDefined();
  });

  it('should save reminder to database', async () => {
    const remindAt = new Date('2024-12-25T08:00:00Z');
    const testInput: CreateReminderInput = {
      task_id: testTaskId,
      remind_at: remindAt,
      method: 'calendar',
      status: 'sent'
    };

    const result = await createReminder(testInput);

    // Query database to verify persistence
    const reminders = await db.select()
      .from(remindersTable)
      .where(eq(remindersTable.id, result.id))
      .execute();

    expect(reminders).toHaveLength(1);
    expect(reminders[0].task_id).toEqual(testTaskId);
    expect(reminders[0].remind_at).toEqual(remindAt);
    expect(reminders[0].method).toEqual('calendar');
    expect(reminders[0].status).toEqual('sent');
    expect(reminders[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle different reminder methods correctly', async () => {
    const remindAt = new Date('2024-12-25T12:00:00Z');
    
    // Test all reminder methods
    const methods = ['app_push', 'email', 'calendar'] as const;
    
    for (const method of methods) {
      const testInput: CreateReminderInput = {
        task_id: testTaskId,
        remind_at: remindAt,
        method: method
      };

      const result = await createReminder(testInput);

      expect(result.method).toEqual(method);
      expect(result.status).toEqual('scheduled'); // Should use default
      expect(result.task_id).toEqual(testTaskId);
    }
  });

  it('should handle different reminder statuses correctly', async () => {
    const remindAt = new Date('2024-12-25T14:00:00Z');
    
    // Test all reminder statuses
    const statuses = ['scheduled', 'sent', 'cancelled'] as const;
    
    for (const status of statuses) {
      const testInput: CreateReminderInput = {
        task_id: testTaskId,
        remind_at: remindAt,
        method: 'email',
        status: status
      };

      const result = await createReminder(testInput);

      expect(result.status).toEqual(status);
      expect(result.method).toEqual('email');
      expect(result.task_id).toEqual(testTaskId);
    }
  });

  it('should fail when task_id does not exist', async () => {
    const nonExistentTaskId = 99999;
    const testInput: CreateReminderInput = {
      task_id: nonExistentTaskId,
      remind_at: new Date('2024-12-25T10:00:00Z'),
      method: 'email'
    };

    await expect(createReminder(testInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should create multiple reminders for the same task', async () => {
    const remindAt1 = new Date('2024-12-25T08:00:00Z');
    const remindAt2 = new Date('2024-12-25T16:00:00Z');

    const input1: CreateReminderInput = {
      task_id: testTaskId,
      remind_at: remindAt1,
      method: 'email'
    };

    const input2: CreateReminderInput = {
      task_id: testTaskId,
      remind_at: remindAt2,
      method: 'app_push'
    };

    const result1 = await createReminder(input1);
    const result2 = await createReminder(input2);

    // Both should succeed with different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.task_id).toEqual(testTaskId);
    expect(result2.task_id).toEqual(testTaskId);
    expect(result1.method).toEqual('email');
    expect(result2.method).toEqual('app_push');

    // Verify both exist in database
    const allReminders = await db.select()
      .from(remindersTable)
      .where(eq(remindersTable.task_id, testTaskId))
      .execute();

    expect(allReminders).toHaveLength(2);
  });
});