import { z } from 'zod';

// Enums
export const sourceEnum = z.enum(['manual', 'meeting', 'import']);
export const taskStatusEnum = z.enum(['todo', 'doing', 'done']);
export const priorityEnum = z.enum(['low', 'med', 'high']);
export const reminderMethodEnum = z.enum(['app_push', 'email', 'calendar']);
export const reminderStatusEnum = z.enum(['scheduled', 'sent', 'cancelled']);
export const agentEventStatusEnum = z.enum(['draft', 'awaiting_confirmation', 'executed', 'error']);
export const llmProviderEnum = z.enum(['openai', 'anthropic', 'google']);

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  display_name: z.string(),
  timezone: z.string(),
  llm_provider: llmProviderEnum,
  llm_model: z.string(),
  created_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Input schema for creating users
export const createUserInputSchema = z.object({
  email: z.string().email(),
  display_name: z.string(),
  timezone: z.string(),
  llm_provider: llmProviderEnum,
  llm_model: z.string()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Workspace schema
export const workspaceSchema = z.object({
  id: z.number(),
  owner_id: z.number(),
  name: z.string(),
  settings: z.record(z.unknown()), // JSON object
  created_at: z.coerce.date()
});

export type Workspace = z.infer<typeof workspaceSchema>;

// Input schema for creating workspaces
export const createWorkspaceInputSchema = z.object({
  owner_id: z.number(),
  name: z.string(),
  settings: z.record(z.unknown()).optional()
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;

// Note schema
export const noteSchema = z.object({
  id: z.number(),
  workspace_id: z.number(),
  title: z.string(),
  source: sourceEnum,
  content_md: z.string(),
  transcript_text: z.string().nullable(),
  summary_text: z.string().nullable(),
  entities: z.record(z.unknown()), // JSON object
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Note = z.infer<typeof noteSchema>;

// Input schema for creating notes
export const createNoteInputSchema = z.object({
  workspace_id: z.number(),
  title: z.string(),
  source: sourceEnum,
  content_md: z.string(),
  transcript_text: z.string().nullable().optional(),
  summary_text: z.string().nullable().optional(),
  entities: z.record(z.unknown()).optional(),
  created_by: z.number()
});

export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;

// Task schema
export const taskSchema = z.object({
  id: z.number(),
  workspace_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusEnum,
  priority: priorityEnum,
  due_at: z.coerce.date().nullable(),
  assignee_id: z.number().nullable(),
  linked_note_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Task = z.infer<typeof taskSchema>;

// Input schema for creating tasks
export const createTaskInputSchema = z.object({
  workspace_id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  due_at: z.coerce.date().nullable().optional(),
  assignee_id: z.number().nullable().optional(),
  linked_note_id: z.number().nullable().optional()
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

// Input schema for updating tasks
export const updateTaskInputSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  due_at: z.coerce.date().nullable().optional(),
  assignee_id: z.number().nullable().optional(),
  linked_note_id: z.number().nullable().optional()
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

// Reminder schema
export const reminderSchema = z.object({
  id: z.number(),
  task_id: z.number(),
  remind_at: z.coerce.date(),
  method: reminderMethodEnum,
  status: reminderStatusEnum,
  created_at: z.coerce.date()
});

export type Reminder = z.infer<typeof reminderSchema>;

// Input schema for creating reminders
export const createReminderInputSchema = z.object({
  task_id: z.number(),
  remind_at: z.coerce.date(),
  method: reminderMethodEnum,
  status: reminderStatusEnum.optional()
});

export type CreateReminderInput = z.infer<typeof createReminderInputSchema>;

// Agent event schema
export const agentEventSchema = z.object({
  id: z.number(),
  workspace_id: z.number(),
  agent: z.string(),
  action: z.string(),
  input: z.record(z.unknown()), // JSON object
  output: z.record(z.unknown()).nullable(), // JSON object
  status: agentEventStatusEnum,
  created_at: z.coerce.date()
});

export type AgentEvent = z.infer<typeof agentEventSchema>;

// Input schema for creating agent events
export const createAgentEventInputSchema = z.object({
  workspace_id: z.number(),
  agent: z.string(),
  action: z.string(),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).nullable().optional(),
  status: agentEventStatusEnum.optional()
});

export type CreateAgentEventInput = z.infer<typeof createAgentEventInputSchema>;

// Meeting transcription input
export const transcribeMeetingInputSchema = z.object({
  workspace_id: z.number(),
  audio_data: z.string() // Base64 encoded audio
});

export type TranscribeMeetingInput = z.infer<typeof transcribeMeetingInputSchema>;

// Finalize meeting input
export const finalizeMeetingInputSchema = z.object({
  workspace_id: z.number(),
  transcript: z.string(),
  title: z.string(),
  created_by: z.number()
});

export type FinalizeMeetingInput = z.infer<typeof finalizeMeetingInputSchema>;

// Calendar draft input
export const createCalendarDraftInputSchema = z.object({
  workspace_id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
  attendees: z.array(z.string().email()).optional()
});

export type CreateCalendarDraftInput = z.infer<typeof createCalendarDraftInputSchema>;

// Agent proposal input
export const agentProposeInputSchema = z.object({
  workspace_id: z.number(),
  agent: z.string(),
  action: z.string(),
  input: z.record(z.unknown()),
  rationale: z.string()
});

export type AgentProposeInput = z.infer<typeof agentProposeInputSchema>;

// Agent confirm input
export const agentConfirmInputSchema = z.object({
  event_id: z.number(),
  approved: z.boolean()
});

export type AgentConfirmInput = z.infer<typeof agentConfirmInputSchema>;