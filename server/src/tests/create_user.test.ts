import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateUserInput = {
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  llm_provider: 'openai',
  llm_model: 'gpt-4'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with all required fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.display_name).toEqual('Test User');
    expect(result.timezone).toEqual('UTC');
    expect(result.llm_provider).toEqual('openai');
    expect(result.llm_model).toEqual('gpt-4');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query the database to verify the user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].display_name).toEqual('Test User');
    expect(users[0].timezone).toEqual('UTC');
    expect(users[0].llm_provider).toEqual('openai');
    expect(users[0].llm_model).toEqual('gpt-4');
    expect(users[0].created_at).toBeInstanceOf(Date);
  });

  it('should enforce unique email constraint', async () => {
    // Create the first user
    await createUser(testInput);

    // Attempt to create another user with the same email
    await expect(createUser(testInput)).rejects.toThrow(/duplicate key|unique constraint/i);
  });

  it('should work with different LLM providers', async () => {
    const anthropicInput: CreateUserInput = {
      email: 'anthropic@example.com',
      display_name: 'Claude User',
      timezone: 'America/New_York',
      llm_provider: 'anthropic',
      llm_model: 'claude-3-opus'
    };

    const result = await createUser(anthropicInput);

    expect(result.llm_provider).toEqual('anthropic');
    expect(result.llm_model).toEqual('claude-3-opus');
    expect(result.timezone).toEqual('America/New_York');
  });

  it('should work with Google LLM provider', async () => {
    const googleInput: CreateUserInput = {
      email: 'google@example.com',
      display_name: 'Gemini User',
      timezone: 'Asia/Tokyo',
      llm_provider: 'google',
      llm_model: 'gemini-pro'
    };

    const result = await createUser(googleInput);

    expect(result.llm_provider).toEqual('google');
    expect(result.llm_model).toEqual('gemini-pro');
    expect(result.display_name).toEqual('Gemini User');
  });

  it('should handle long display names', async () => {
    const longNameInput: CreateUserInput = {
      email: 'longname@example.com',
      display_name: 'This is a very long display name that tests the text field capacity',
      timezone: 'Europe/London',
      llm_provider: 'openai',
      llm_model: 'gpt-3.5-turbo'
    };

    const result = await createUser(longNameInput);

    expect(result.display_name).toEqual('This is a very long display name that tests the text field capacity');
    expect(result.email).toEqual('longname@example.com');
  });

  it('should create multiple users with different emails', async () => {
    const user1Input: CreateUserInput = {
      email: 'user1@example.com',
      display_name: 'User One',
      timezone: 'UTC',
      llm_provider: 'openai',
      llm_model: 'gpt-4'
    };

    const user2Input: CreateUserInput = {
      email: 'user2@example.com',
      display_name: 'User Two',
      timezone: 'America/Chicago',
      llm_provider: 'anthropic',
      llm_model: 'claude-3-sonnet'
    };

    const result1 = await createUser(user1Input);
    const result2 = await createUser(user2Input);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.email).toEqual('user1@example.com');
    expect(result2.email).toEqual('user2@example.com');

    // Verify both users exist in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
  });
});