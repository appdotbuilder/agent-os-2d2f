import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { type CreateNoteInput } from '../schema';
import { createNote } from '../handlers/create_note';
import { eq } from 'drizzle-orm';

// Create test user and workspace
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

const createTestWorkspace = async (ownerId: number) => {
  const result = await db.insert(workspacesTable)
    .values({
      owner_id: ownerId,
      name: 'Test Workspace',
      settings: {}
    })
    .returning()
    .execute();
  return result[0];
};

describe('createNote', () => {
  let testUser: any;
  let testWorkspace: any;

  beforeEach(async () => {
    await createDB();
    testUser = await createTestUser();
    testWorkspace = await createTestWorkspace(testUser.id);
  });

  afterEach(resetDB);

  it('should create a note with all required fields', async () => {
    const testInput: CreateNoteInput = {
      workspace_id: testWorkspace.id,
      title: 'Test Note',
      source: 'manual',
      content_md: '# Test Content\n\nThis is a test note.',
      created_by: testUser.id
    };

    const result = await createNote(testInput);

    // Basic field validation
    expect(result.title).toEqual('Test Note');
    expect(result.workspace_id).toEqual(testWorkspace.id);
    expect(result.source).toEqual('manual');
    expect(result.content_md).toEqual('# Test Content\n\nThis is a test note.');
    expect(result.created_by).toEqual(testUser.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Optional fields should be null when not provided
    expect(result.transcript_text).toBeNull();
    expect(result.summary_text).toBeNull();
    expect(result.entities).toEqual({});
  });

  it('should create a note with all optional fields', async () => {
    const testInput: CreateNoteInput = {
      workspace_id: testWorkspace.id,
      title: 'Meeting Note',
      source: 'meeting',
      content_md: '# Meeting Summary\n\nDiscussed project timeline.',
      transcript_text: 'John: We need to discuss the timeline...',
      summary_text: 'Meeting covered project timeline and milestones.',
      entities: { 
        people: ['John', 'Jane'], 
        topics: ['timeline', 'milestones'] 
      },
      created_by: testUser.id
    };

    const result = await createNote(testInput);

    expect(result.title).toEqual('Meeting Note');
    expect(result.source).toEqual('meeting');
    expect(result.transcript_text).toEqual('John: We need to discuss the timeline...');
    expect(result.summary_text).toEqual('Meeting covered project timeline and milestones.');
    expect(result.entities).toEqual({ 
      people: ['John', 'Jane'], 
      topics: ['timeline', 'milestones'] 
    });
  });

  it('should save note to database', async () => {
    const testInput: CreateNoteInput = {
      workspace_id: testWorkspace.id,
      title: 'Database Test Note',
      source: 'import',
      content_md: 'Content for database test.',
      created_by: testUser.id
    };

    const result = await createNote(testInput);

    // Query database to verify note was saved
    const notes = await db.select()
      .from(notesTable)
      .where(eq(notesTable.id, result.id))
      .execute();

    expect(notes).toHaveLength(1);
    expect(notes[0].title).toEqual('Database Test Note');
    expect(notes[0].workspace_id).toEqual(testWorkspace.id);
    expect(notes[0].source).toEqual('import');
    expect(notes[0].content_md).toEqual('Content for database test.');
    expect(notes[0].created_by).toEqual(testUser.id);
    expect(notes[0].created_at).toBeInstanceOf(Date);
    expect(notes[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle different source types', async () => {
    const sources = ['manual', 'meeting', 'import'] as const;
    
    for (const source of sources) {
      const testInput: CreateNoteInput = {
        workspace_id: testWorkspace.id,
        title: `${source} Note`,
        source: source,
        content_md: `Content from ${source}.`,
        created_by: testUser.id
      };

      const result = await createNote(testInput);
      expect(result.source).toEqual(source);
      expect(result.title).toEqual(`${source} Note`);
    }
  });

  it('should throw error when workspace does not exist', async () => {
    const testInput: CreateNoteInput = {
      workspace_id: 99999, // Non-existent workspace
      title: 'Invalid Workspace Note',
      source: 'manual',
      content_md: 'This should fail.',
      created_by: testUser.id
    };

    await expect(createNote(testInput)).rejects.toThrow(/foreign key constraint/i);
  });

  it('should throw error when created_by user does not exist', async () => {
    const testInput: CreateNoteInput = {
      workspace_id: testWorkspace.id,
      title: 'Invalid User Note',
      source: 'manual',
      content_md: 'This should fail.',
      created_by: 99999 // Non-existent user
    };

    await expect(createNote(testInput)).rejects.toThrow(/foreign key constraint/i);
  });
});