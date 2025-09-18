import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createWorkspaceInputSchema,
  createNoteInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  createReminderInputSchema,
  transcribeMeetingInputSchema,
  finalizeMeetingInputSchema,
  createCalendarDraftInputSchema,
  agentProposeInputSchema,
  agentConfirmInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { createWorkspace } from './handlers/create_workspace';
import { createNote } from './handlers/create_note';
import { createTask } from './handlers/create_task';
import { updateTask } from './handlers/update_task';
import { getTasks } from './handlers/get_tasks';
import { createReminder } from './handlers/create_reminder';
import { transcribeMeeting } from './handlers/transcribe_meeting';
import { finalizeMeeting } from './handlers/finalize_meeting';
import { createCalendarDraft } from './handlers/create_calendar_draft';
import { agentPropose } from './handlers/agent_propose';
import { agentConfirm } from './handlers/agent_confirm';
import { getNotes } from './handlers/get_notes';
import { getAgentEvents } from './handlers/get_agent_events';
import { getUpcomingReminders } from './handlers/get_upcoming_reminders';
import { getWorkspaces } from './handlers/get_workspaces';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  // Workspace management
  createWorkspace: publicProcedure
    .input(createWorkspaceInputSchema)
    .mutation(({ input }) => createWorkspace(input)),

  getWorkspaces: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getWorkspaces(input.userId)),

  // Note management
  createNote: publicProcedure
    .input(createNoteInputSchema)
    .mutation(({ input }) => createNote(input)),

  getNotes: publicProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(({ input }) => getNotes(input.workspaceId)),

  // Task management
  createTask: publicProcedure
    .input(createTaskInputSchema)
    .mutation(({ input }) => createTask(input)),

  updateTask: publicProcedure
    .input(updateTaskInputSchema)
    .mutation(({ input }) => updateTask(input)),

  getTasks: publicProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(({ input }) => getTasks(input.workspaceId)),

  // Reminder management
  createReminder: publicProcedure
    .input(createReminderInputSchema)
    .mutation(({ input }) => createReminder(input)),

  getUpcomingReminders: publicProcedure
    .input(z.object({ workspaceId: z.number(), limit: z.number().optional() }))
    .query(({ input }) => getUpcomingReminders(input.workspaceId, input.limit)),

  // Meeting functionality
  transcribeMeeting: publicProcedure
    .input(transcribeMeetingInputSchema)
    .mutation(({ input }) => transcribeMeeting(input)),

  finalizeMeeting: publicProcedure
    .input(finalizeMeetingInputSchema)
    .mutation(({ input }) => finalizeMeeting(input)),

  // Calendar integration
  createCalendarDraft: publicProcedure
    .input(createCalendarDraftInputSchema)
    .mutation(({ input }) => createCalendarDraft(input)),

  // Agent system
  agentPropose: publicProcedure
    .input(agentProposeInputSchema)
    .mutation(({ input }) => agentPropose(input)),

  agentConfirm: publicProcedure
    .input(agentConfirmInputSchema)
    .mutation(({ input }) => agentConfirm(input)),

  getAgentEvents: publicProcedure
    .input(z.object({ 
      workspaceId: z.number(),
      status: z.enum(['draft', 'awaiting_confirmation', 'executed', 'error']).optional()
    }))
    .query(({ input }) => getAgentEvents(input.workspaceId, input.status)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`User OS tRPC server listening at port: ${port}`);
}

start();