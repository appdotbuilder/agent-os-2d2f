import { serial, text, pgTable, timestamp, integer, json, pgEnum, index } from 'drizzle-orm/pg-core';

// Define enums
export const sourceEnum = pgEnum('source', ['manual', 'meeting', 'import']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'doing', 'done']);
export const priorityEnum = pgEnum('priority', ['low', 'med', 'high']);
export const reminderMethodEnum = pgEnum('reminder_method', ['app_push', 'email', 'calendar']);
export const reminderStatusEnum = pgEnum('reminder_status', ['scheduled', 'sent', 'cancelled']);
export const agentEventStatusEnum = pgEnum('agent_event_status', ['draft', 'awaiting_confirmation', 'executed', 'error']);
export const llmProviderEnum = pgEnum('llm_provider', ['openai', 'anthropic', 'google']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  display_name: text('display_name').notNull(),
  timezone: text('timezone').notNull(),
  llm_provider: llmProviderEnum('llm_provider').notNull(),
  llm_model: text('llm_model').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Workspaces table
export const workspacesTable = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  owner_id: integer('owner_id').notNull().references(() => usersTable.id),
  name: text('name').notNull(),
  settings: json('settings').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Notes table
export const notesTable = pgTable('notes', {
  id: serial('id').primaryKey(),
  workspace_id: integer('workspace_id').notNull().references(() => workspacesTable.id),
  title: text('title').notNull(),
  source: sourceEnum('source').notNull(),
  content_md: text('content_md').notNull(),
  transcript_text: text('transcript_text'), // Nullable
  summary_text: text('summary_text'), // Nullable
  entities: json('entities').notNull(),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceCreatedAtIdx: index('notes_workspace_id_created_at_idx').on(table.workspace_id, table.created_at.desc()),
}));

// Tasks table
export const tasksTable = pgTable('tasks', {
  id: serial('id').primaryKey(),
  workspace_id: integer('workspace_id').notNull().references(() => workspacesTable.id),
  title: text('title').notNull(),
  description: text('description'), // Nullable
  status: taskStatusEnum('status').notNull().default('todo'),
  priority: priorityEnum('priority').notNull().default('med'),
  due_at: timestamp('due_at'), // Nullable
  assignee_id: integer('assignee_id').references(() => usersTable.id), // Nullable
  linked_note_id: integer('linked_note_id').references(() => notesTable.id), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  workspaceStatusDueAtIdx: index('tasks_workspace_id_status_due_at_idx').on(table.workspace_id, table.status, table.due_at),
}));

// Reminders table
export const remindersTable = pgTable('reminders', {
  id: serial('id').primaryKey(),
  task_id: integer('task_id').notNull().references(() => tasksTable.id),
  remind_at: timestamp('remind_at').notNull(),
  method: reminderMethodEnum('method').notNull(),
  status: reminderStatusEnum('status').notNull().default('scheduled'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  remindAtIdx: index('reminders_remind_at_idx').on(table.remind_at),
}));

// Agent events table
export const agentEventsTable = pgTable('agent_events', {
  id: serial('id').primaryKey(),
  workspace_id: integer('workspace_id').notNull().references(() => workspacesTable.id),
  agent: text('agent').notNull(),
  action: text('action').notNull(),
  input: json('input').notNull(),
  output: json('output'), // Nullable
  status: agentEventStatusEnum('status').notNull().default('draft'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  workspaceCreatedAtIdx: index('agent_events_workspace_id_created_at_idx').on(table.workspace_id, table.created_at.desc()),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Workspace = typeof workspacesTable.$inferSelect;
export type NewWorkspace = typeof workspacesTable.$inferInsert;

export type Note = typeof notesTable.$inferSelect;
export type NewNote = typeof notesTable.$inferInsert;

export type Task = typeof tasksTable.$inferSelect;
export type NewTask = typeof tasksTable.$inferInsert;

export type Reminder = typeof remindersTable.$inferSelect;
export type NewReminder = typeof remindersTable.$inferInsert;

export type AgentEvent = typeof agentEventsTable.$inferSelect;
export type NewAgentEvent = typeof agentEventsTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  workspaces: workspacesTable,
  notes: notesTable,
  tasks: tasksTable,
  reminders: remindersTable,
  agentEvents: agentEventsTable
};