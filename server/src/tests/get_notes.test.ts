import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, workspacesTable, notesTable } from '../db/schema';
import { getNotes } from '../handlers/get_notes';

describe('getNotes', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let testWorkspace: any;

  beforeEach(async () => {
    // Create test user directly in database
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
    testUser = userResult[0];

    // Create test workspace directly in database
    const workspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: testUser.id,
        name: 'Test Workspace',
        settings: { theme: 'dark' }
      })
      .returning()
      .execute();
    testWorkspace = workspaceResult[0];
  });

  it('should return empty array when no notes exist', async () => {
    const result = await getNotes(testWorkspace.id);

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return notes for specific workspace', async () => {
    // Create test note directly in database
    const noteResult = await db.insert(notesTable)
      .values({
        workspace_id: testWorkspace.id,
        title: 'Test Note',
        source: 'manual',
        content_md: '# Test Note\nThis is a test note.',
        entities: { tags: ['test'] },
        created_by: testUser.id
      })
      .returning()
      .execute();
    const createdNote = noteResult[0];

    const result = await getNotes(testWorkspace.id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(createdNote.id);
    expect(result[0].title).toEqual('Test Note');
    expect(result[0].source).toEqual('manual');
    expect(result[0].content_md).toEqual('# Test Note\nThis is a test note.');
    expect(result[0].workspace_id).toEqual(testWorkspace.id);
    expect(result[0].created_by).toEqual(testUser.id);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return notes ordered by created_at desc', async () => {
    // Create multiple notes with slight delays to ensure different timestamps
    const firstNoteResult = await db.insert(notesTable)
      .values({
        workspace_id: testWorkspace.id,
        title: 'First Note',
        source: 'manual',
        content_md: 'First note content',
        entities: {},
        created_by: testUser.id
      })
      .returning()
      .execute();
    const firstNote = firstNoteResult[0];

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondNoteResult = await db.insert(notesTable)
      .values({
        workspace_id: testWorkspace.id,
        title: 'Second Note',
        source: 'meeting',
        content_md: 'Second note content',
        entities: {},
        created_by: testUser.id
      })
      .returning()
      .execute();
    const secondNote = secondNoteResult[0];

    await new Promise(resolve => setTimeout(resolve, 10));

    const thirdNoteResult = await db.insert(notesTable)
      .values({
        workspace_id: testWorkspace.id,
        title: 'Third Note',
        source: 'import',
        content_md: 'Third note content',
        entities: {},
        created_by: testUser.id
      })
      .returning()
      .execute();
    const thirdNote = thirdNoteResult[0];

    const result = await getNotes(testWorkspace.id);

    expect(result).toHaveLength(3);
    // Should be ordered by created_at desc (newest first)
    expect(result[0].title).toEqual('Third Note');
    expect(result[1].title).toEqual('Second Note');
    expect(result[2].title).toEqual('First Note');

    // Verify the ordering is correct by checking timestamps
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });

  it('should only return notes for the specified workspace', async () => {
    // Create second workspace directly in database
    const secondWorkspaceResult = await db.insert(workspacesTable)
      .values({
        owner_id: testUser.id,
        name: 'Second Workspace',
        settings: {}
      })
      .returning()
      .execute();
    const secondWorkspace = secondWorkspaceResult[0];

    // Create note in first workspace
    await db.insert(notesTable)
      .values({
        workspace_id: testWorkspace.id,
        title: 'Workspace 1 Note',
        source: 'manual',
        content_md: 'Note in workspace 1',
        entities: {},
        created_by: testUser.id
      })
      .execute();

    // Create note in second workspace
    await db.insert(notesTable)
      .values({
        workspace_id: secondWorkspace.id,
        title: 'Workspace 2 Note',
        source: 'manual',
        content_md: 'Note in workspace 2',
        entities: {},
        created_by: testUser.id
      })
      .execute();

    // Get notes for first workspace
    const workspace1Notes = await getNotes(testWorkspace.id);
    expect(workspace1Notes).toHaveLength(1);
    expect(workspace1Notes[0].title).toEqual('Workspace 1 Note');
    expect(workspace1Notes[0].workspace_id).toEqual(testWorkspace.id);

    // Get notes for second workspace
    const workspace2Notes = await getNotes(secondWorkspace.id);
    expect(workspace2Notes).toHaveLength(1);
    expect(workspace2Notes[0].title).toEqual('Workspace 2 Note');
    expect(workspace2Notes[0].workspace_id).toEqual(secondWorkspace.id);
  });

  it('should handle notes with nullable fields', async () => {
    // Create note with nullable fields populated
    await db.insert(notesTable)
      .values({
        workspace_id: testWorkspace.id,
        title: 'Note with transcript',
        source: 'meeting',
        content_md: 'Meeting notes content',
        transcript_text: 'This is the meeting transcript',
        summary_text: 'This is the summary',
        entities: { speakers: ['John', 'Jane'] },
        created_by: testUser.id
      })
      .execute();

    // Create note with nullable fields as null
    await db.insert(notesTable)
      .values({
        workspace_id: testWorkspace.id,
        title: 'Manual note',
        source: 'manual',
        content_md: 'Manual content',
        transcript_text: null,
        summary_text: null,
        entities: {},
        created_by: testUser.id
      })
      .execute();

    const result = await getNotes(testWorkspace.id);

    expect(result).toHaveLength(2);
    
    // Find the notes by title
    const transcriptNote = result.find(note => note.title === 'Note with transcript');
    const manualNote = result.find(note => note.title === 'Manual note');

    // Verify nullable fields
    expect(transcriptNote?.transcript_text).toEqual('This is the meeting transcript');
    expect(transcriptNote?.summary_text).toEqual('This is the summary');
    
    expect(manualNote?.transcript_text).toBeNull();
    expect(manualNote?.summary_text).toBeNull();
  });

  it('should handle non-existent workspace', async () => {
    const result = await getNotes(99999); // Non-existent workspace ID

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });
});