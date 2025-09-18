import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { workspacesTable, usersTable } from '../db/schema';
import { type CreateWorkspaceInput } from '../schema';
import { createWorkspace } from '../handlers/create_workspace';
import { eq } from 'drizzle-orm';

// Helper to create a test user for foreign key relationships
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      email: 'test@example.com',
      display_name: 'Test User',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4'
    })
    .returning()
    .execute();
  
  return result[0];
};

// Simple test input
const getTestInput = (owner_id: number): CreateWorkspaceInput => ({
  owner_id,
  name: 'Test Workspace'
});

describe('createWorkspace', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a workspace with basic information', async () => {
    const user = await createTestUser();
    const testInput = getTestInput(user.id);
    
    const result = await createWorkspace(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Workspace');
    expect(result.owner_id).toEqual(user.id);
    expect(result.settings).toEqual({});
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a workspace with custom settings', async () => {
    const user = await createTestUser();
    const testInput: CreateWorkspaceInput = {
      owner_id: user.id,
      name: 'Custom Workspace',
      settings: {
        theme: 'dark',
        notifications: true,
        default_priority: 'high'
      }
    };
    
    const result = await createWorkspace(testInput);

    expect(result.name).toEqual('Custom Workspace');
    expect(result.owner_id).toEqual(user.id);
    expect(result.settings).toEqual({
      theme: 'dark',
      notifications: true,
      default_priority: 'high'
    });
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save workspace to database', async () => {
    const user = await createTestUser();
    const testInput = getTestInput(user.id);
    
    const result = await createWorkspace(testInput);

    // Query using proper drizzle syntax
    const workspaces = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, result.id))
      .execute();

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toEqual('Test Workspace');
    expect(workspaces[0].owner_id).toEqual(user.id);
    expect(workspaces[0].settings).toEqual({});
    expect(workspaces[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle workspaces with complex nested settings', async () => {
    const user = await createTestUser();
    const complexSettings = {
      ui: {
        theme: 'dark',
        sidebar: 'collapsed',
        language: 'en'
      },
      features: {
        ai_assistance: true,
        auto_save: false,
        integrations: ['slack', 'teams']
      },
      permissions: {
        default_role: 'member',
        allow_guest_access: true
      }
    };
    
    const testInput: CreateWorkspaceInput = {
      owner_id: user.id,
      name: 'Complex Workspace',
      settings: complexSettings
    };
    
    const result = await createWorkspace(testInput);

    expect(result.settings).toEqual(complexSettings);
    expect(result.name).toEqual('Complex Workspace');
    
    // Verify in database
    const workspaces = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, result.id))
      .execute();

    expect(workspaces[0].settings).toEqual(complexSettings);
  });

  it('should create multiple workspaces for the same owner', async () => {
    const user = await createTestUser();
    
    const workspace1 = await createWorkspace({
      owner_id: user.id,
      name: 'Workspace One'
    });
    
    const workspace2 = await createWorkspace({
      owner_id: user.id,
      name: 'Workspace Two',
      settings: { type: 'personal' }
    });

    expect(workspace1.id).not.toEqual(workspace2.id);
    expect(workspace1.owner_id).toEqual(user.id);
    expect(workspace2.owner_id).toEqual(user.id);
    expect(workspace1.name).toEqual('Workspace One');
    expect(workspace2.name).toEqual('Workspace Two');
    expect(workspace2.settings).toEqual({ type: 'personal' });
    
    // Verify both exist in database
    const allWorkspaces = await db.select()
      .from(workspacesTable)
      .where(eq(workspacesTable.owner_id, user.id))
      .execute();

    expect(allWorkspaces).toHaveLength(2);
  });

  it('should handle empty settings gracefully', async () => {
    const user = await createTestUser();
    const testInput: CreateWorkspaceInput = {
      owner_id: user.id,
      name: 'Empty Settings Workspace',
      settings: {}
    };
    
    const result = await createWorkspace(testInput);

    expect(result.settings).toEqual({});
    expect(result.name).toEqual('Empty Settings Workspace');
  });
});