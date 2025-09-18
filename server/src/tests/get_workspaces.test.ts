import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable } from '../db/schema';
import { type CreateUserInput, type CreateWorkspaceInput } from '../schema';
import { getWorkspaces } from '../handlers/get_workspaces';

// Test data
const testUser1: CreateUserInput = {
  email: 'user1@test.com',
  display_name: 'Test User 1',
  timezone: 'America/New_York',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

const testUser2: CreateUserInput = {
  email: 'user2@test.com',
  display_name: 'Test User 2',
  timezone: 'America/Los_Angeles',
  llm_provider: 'anthropic',
  llm_model: 'claude-3'
};

const testWorkspace1 = {
  name: 'Personal Workspace',
  settings: { theme: 'dark', notifications: true }
};

const testWorkspace2 = {
  name: 'Work Workspace',
  settings: { theme: 'light', notifications: false }
};

describe('getWorkspaces', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no workspaces', async () => {
    // Create a user but no workspaces
    const userResult = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();
    
    const userId = userResult[0].id;
    const workspaces = await getWorkspaces(userId);

    expect(workspaces).toEqual([]);
  });

  it('should return user-owned workspaces', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create workspaces for this user
    await db.insert(workspacesTable)
      .values([
        {
          owner_id: userId,
          name: testWorkspace1.name,
          settings: testWorkspace1.settings
        },
        {
          owner_id: userId,
          name: testWorkspace2.name,
          settings: testWorkspace2.settings
        }
      ])
      .execute();

    const workspaces = await getWorkspaces(userId);

    expect(workspaces).toHaveLength(2);
    expect(workspaces.map(w => w.name)).toContain('Personal Workspace');
    expect(workspaces.map(w => w.name)).toContain('Work Workspace');
    
    // Verify all workspaces belong to the correct user
    workspaces.forEach(workspace => {
      expect(workspace.owner_id).toEqual(userId);
      expect(workspace.id).toBeDefined();
      expect(workspace.created_at).toBeInstanceOf(Date);
      expect(typeof workspace.settings).toBe('object');
    });
  });

  it('should only return workspaces owned by the specific user', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();
    
    const user2Result = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();
    
    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create workspaces for both users
    await db.insert(workspacesTable)
      .values([
        {
          owner_id: user1Id,
          name: testWorkspace1.name,
          settings: testWorkspace1.settings
        },
        {
          owner_id: user2Id,
          name: testWorkspace2.name,
          settings: testWorkspace2.settings
        }
      ])
      .execute();

    // Get workspaces for user1
    const user1Workspaces = await getWorkspaces(user1Id);
    expect(user1Workspaces).toHaveLength(1);
    expect(user1Workspaces[0].name).toEqual('Personal Workspace');
    expect(user1Workspaces[0].owner_id).toEqual(user1Id);

    // Get workspaces for user2
    const user2Workspaces = await getWorkspaces(user2Id);
    expect(user2Workspaces).toHaveLength(1);
    expect(user2Workspaces[0].name).toEqual('Work Workspace');
    expect(user2Workspaces[0].owner_id).toEqual(user2Id);
  });

  it('should handle non-existent user gracefully', async () => {
    const nonExistentUserId = 99999;
    const workspaces = await getWorkspaces(nonExistentUserId);

    expect(workspaces).toEqual([]);
  });

  it('should return workspaces with all required fields', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser1)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create workspace with complete data
    await db.insert(workspacesTable)
      .values({
        owner_id: userId,
        name: testWorkspace1.name,
        settings: testWorkspace1.settings
      })
      .execute();

    const workspaces = await getWorkspaces(userId);

    expect(workspaces).toHaveLength(1);
    const workspace = workspaces[0];

    // Verify all schema fields are present
    expect(workspace.id).toBeDefined();
    expect(workspace.owner_id).toEqual(userId);
    expect(workspace.name).toEqual('Personal Workspace');
    expect(workspace.settings).toEqual({ theme: 'dark', notifications: true });
    expect(workspace.created_at).toBeInstanceOf(Date);

    // Verify the settings structure
    expect(typeof workspace.settings).toBe('object');
    expect(workspace.settings).not.toBeNull();
  });
});