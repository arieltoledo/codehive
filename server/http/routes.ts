import type { FastifyInstance } from "fastify";
import { z } from "zod";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getTrustedKey } from "./auth.js";

import {
  DEFAULT_MESSAGE_LIMIT,
  DEFAULT_ROOM_ID,
  MAX_MESSAGE_LIMIT
} from "../config/defaults.js";
import type { GoalRecord } from "../domain/types.js";
import type { DomainServices } from "../domain/services.js";
import { initializeProject } from "../utils/project-init.js";
import {
  toAgentDto, 
  toGoalDto,
  toMessageDto, 
  toTaskDto, 
  toFileClaimDto, 
  toDecisionDto,
  toScheduleDto,
  toSessionSnapshotDto,
  toSubagentDto,
  toSubagentInstanceDto
} from "./presenters.js";
import { handleWebsocket } from "./websockets.js";

const messageQuerySchema = z.object({
  room_id: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_MESSAGE_LIMIT).optional()
});

const sendMessageSchema = z.object({
  projectId: z.string().min(1).optional(),
  room_id: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  sender_id: z.string().min(1).optional(),
  senderId: z.string().min(1).optional(),
  message: z.string().min(1),
  message_type: z.string().min(1).optional(),
  messageType: z.string().min(1).optional(),
  task_id: z.string().min(1).nullable().optional(),
  taskId: z.string().min(1).nullable().optional()
});

const registerAgentSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  name: z.string().min(1),
  provider: z.string().min(1),
  role: z.string().min(1),
  parent_agent_id: z.string().min(1).nullable().optional(),
  parentAgentId: z.string().min(1).nullable().optional()
});

const updateAgentStatusSchema = z.object({
  agent_id: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  status: z.string().min(1)
});

const startTaskSchema = z.object({
  projectId: z.string().min(1).optional(),
  task_id: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  parent_task_id: z.string().min(1).nullable().optional(),
  parentTaskId: z.string().min(1).nullable().optional(),
  agent_id: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1)
});

const finishTaskSchema = z.object({
  task_id: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  status: z.enum(["done", "error"])
});

const claimFileSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  file_path: z.string().min(1).optional(),
  filePath: z.string().min(1).optional(),
  task_id: z.string().min(1).nullable().optional(),
  taskId: z.string().min(1).nullable().optional(),
  reason: z.string().min(1)
});

const releaseFileSchema = z.object({
  agent_id: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  file_path: z.string().min(1).optional(),
  filePath: z.string().min(1).optional()
});

const recordDecisionSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  task_id: z.string().min(1).nullable().optional(),
  taskId: z.string().min(1).nullable().optional(),
  decision: z.string().min(1),
  reason: z.string().min(1)
});

const createProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional()
});

const publishMemorySchema = z.object({
  projectId: z.string().min(1).optional(),
  filename: z.string().min(1),
  content: z.string().min(1)
});

const approveMemorySchema = z.object({
  projectId: z.string().min(1).optional(),
  filename: z.string().min(1)
});

export async function registerRoutes(
  app: FastifyInstance,
  services: DomainServices
): Promise<void> {
  app.get("/health", async () => ({
    status: "ok"
  }));

  // Projects
  app.get("/api/projects", async (request, reply) => {
    const projects = await services.prisma.project.findMany({
      include: {
        _count: {
          select: { agents: true, tasks: { where: { finishedAt: null } } }
        }
      }
    });

    const trustedKey = await getTrustedKey();
    const isLocal = request.hostname.includes('localhost') || request.hostname.includes('127.0.0.1');

    return { 
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        agentCount: p._count.agents,
        activeTasksCount: p._count.tasks,
        createdAt: p.createdAt,
        // Only expose key to local dashboard for administrative ease
        apiKey: isLocal ? trustedKey : null
      }))
    };
  });

  app.post("/api/projects", async (request, reply) => {
    const providedKey = request.headers["x-hive-key"] as string;
    const trustedKey = await getTrustedKey();

    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const { id, name, description } = parsed.data;

    // Security: Only the human (with trustedKey) can create/update projects
    if (trustedKey && providedKey !== trustedKey) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Administrative authorization required." } });
    }

    const project = await services.prisma.project.upsert({
      where: { id },
      create: {
        id,
        name,
        description: description ?? null,
        apiKey: trustedKey || null
      },
      update: {
        name,
        description: description ?? null
      }
    });

    return project;
  });

  app.delete("/api/projects/:projectId", async (request, reply) => {
    const providedKey = request.headers["x-hive-key"] as string;
    const trustedKey = await getTrustedKey();
    const { projectId } = request.params as any;

    // Security check: Must match the global trusted key
    if (trustedKey && providedKey !== trustedKey) {
      return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Administrative authorization required." } });
    }

    try {
      await services.projects.deleteProject(projectId);
      return { success: true };
    } catch (error) {
      return reply.status(400).send({ error: { code: "DELETE_FAILED", message: (error as Error).message } });
    }
  });

  // Agents
  app.get("/api/projects/:projectId/agents", async (request) => {
    const { projectId } = request.params as any;
    const agents = await services.agents.listAgents(projectId);
    return {
      agents: agents.map(toAgentDto)
    };
  });

  app.post("/api/agents/register", async (request, reply) => {
    const parsed = registerAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const agentId = parsed.data.agent_id ?? parsed.data.agentId;
    const projectId = parsed.data.projectId ?? "local";

    if (!agentId) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "agent_id or agentId is required" } });
    }

    const agent = await services.agents.registerAgent({
      projectId,
      agentId,
      name: parsed.data.name,
      provider: parsed.data.provider,
      role: parsed.data.role,
      parentAgentId: parsed.data.parent_agent_id ?? parsed.data.parentAgentId ?? null
    });

    return toAgentDto(agent);
  });

  app.post("/api/agents/update-status", async (request, reply) => {
    const parsed = updateAgentStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const agentId = parsed.data.agent_id ?? parsed.data.agentId;
    if (!agentId) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "agent_id or agentId is required" } });
    }

    const agent = await services.agents.updateStatus(agentId, parsed.data.status as any);
    return toAgentDto(agent);
  });

  // Messages
  app.get("/api/projects/:projectId/messages", async (request, reply) => {
    const { projectId } = request.params as any;
    const parsed = messageQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "INVALID_QUERY",
          message: parsed.error.message
        }
      });
    }

    const roomId = parsed.data.room_id ?? parsed.data.roomId ?? DEFAULT_ROOM_ID;
    const limit = parsed.data.limit ?? DEFAULT_MESSAGE_LIMIT;
    const messages = await services.chat.readMessages({ projectId, roomId, limit });

    return {
      messages: messages.map(toMessageDto)
    };
  });

  app.post("/api/messages", async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: "INVALID_BODY",
          message: parsed.error.message
        }
      });
    }

    const projectId = parsed.data.projectId ?? "local";
    const roomId = parsed.data.room_id ?? parsed.data.roomId ?? DEFAULT_ROOM_ID;
    const senderId = parsed.data.sender_id ?? parsed.data.senderId;
    const messageType = parsed.data.message_type ?? parsed.data.messageType ?? "status";
    const taskId = parsed.data.task_id ?? parsed.data.taskId ?? null;

    if (!senderId) {
      return reply.status(400).send({
        error: {
          code: "MISSING_SENDER",
          message: "sender_id or senderId is required"
        }
      });
    }

    // Security: Protect human_supervisor identity
    if (senderId === 'human_supervisor') {
      const providedKey = request.headers["x-hive-key"] as string;
      const trustedKey = await getTrustedKey();

      if (trustedKey && providedKey !== trustedKey) {
        return reply.status(401).send({ error: { code: "UNAUTHORIZED", message: "Human impersonation detected. Invalid Master API key." } });
      }
    }

    const message = await services.chat.sendMessage({
      projectId,
      roomId,
      senderId,
      message: parsed.data.message,
      messageType,
      taskId
    });

    return toMessageDto(message);
  });

  // Tasks
  app.post("/api/tasks/start", async (request, reply) => {
    const parsed = startTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const taskId = parsed.data.task_id ?? parsed.data.taskId;
    const parentTaskId = parsed.data.parent_task_id ?? parsed.data.parentTaskId ?? null;
    const agentId = parsed.data.agent_id ?? parsed.data.agentId;
    const projectId = parsed.data.projectId ?? "local";

    if (!taskId || !agentId) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "taskId and agentId are required" } });
    }

    const task = await services.tasks.startTask({
      projectId,
      taskId,
      parentTaskId,
      agentId,
      title: parsed.data.title,
      description: parsed.data.description
    });

    return toTaskDto(task);
  });

  app.post("/api/tasks/finish", async (request, reply) => {
    const parsed = finishTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const taskId = parsed.data.task_id ?? parsed.data.taskId;
    if (!taskId) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "taskId is required" } });
    }

    const task = await services.tasks.finishTask({
      taskId,
      status: parsed.data.status
    });

    return toTaskDto(task);
  });

  // Traceability
  app.post("/api/traceability/claim-file", async (request, reply) => {
    const parsed = claimFileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const agentId = parsed.data.agent_id ?? parsed.data.agentId;
    const filePath = parsed.data.file_path ?? parsed.data.filePath;
    const projectId = parsed.data.projectId ?? "local";

    if (!agentId || !filePath) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "agentId and filePath are required" } });
    }

    const claim = await services.traceability.claimFile({
      projectId,
      agentId,
      filePath,
      taskId: parsed.data.task_id ?? parsed.data.taskId ?? null,
      reason: parsed.data.reason
    });

    return toFileClaimDto(claim as any);
  });

  app.post("/api/traceability/release-file", async (request, reply) => {
    const parsed = releaseFileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const agentId = parsed.data.agent_id ?? parsed.data.agentId;
    const filePath = parsed.data.file_path ?? parsed.data.filePath;

    if (!agentId || !filePath) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "agentId and filePath are required" } });
    }

    const claim = await services.traceability.releaseFile({
      agentId,
      filePath
    });

    return toFileClaimDto(claim as any);
  });

  app.post("/api/traceability/record-decision", async (request, reply) => {
    const parsed = recordDecisionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const agentId = parsed.data.agent_id ?? parsed.data.agentId;
    const projectId = parsed.data.projectId ?? "local";

    if (!agentId) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "agentId is required" } });
    }

    const decision = await services.traceability.recordDecision({
      projectId,
      agentId,
      taskId: parsed.data.task_id ?? parsed.data.taskId ?? null,
      decision: parsed.data.decision,
      reason: parsed.data.reason
    });

    return toDecisionDto(decision as any);
  });

  // Memory (Shared Knowledge Base)
  app.get("/api/projects/:projectId/memory", async (request) => {
    const { projectId } = request.params as any;
    const files = await services.memory.listFiles(projectId);
    return { files };
  });

  app.get("/api/projects/:projectId/memory/:filename", async (request, reply) => {
    const { projectId, filename } = request.params as any;
    try {
      const { content, type } = await services.memory.readFile(projectId, filename);
      return reply.type(type).send(content);
    } catch (error) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: (error as Error).message } });
    }
  });

  app.post("/api/memory/publish", async (request, reply) => {
    const parsed = publishMemorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const projectId = parsed.data.projectId ?? "local";
    const file = await services.memory.publishFile(projectId, parsed.data.filename, parsed.data.content);
    return file;
  });

  app.post("/api/memory/upload", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });
    }

    const projectId = (data.fields.projectId as any)?.value ?? "local";
    const buffer = await data.toBuffer();
    
    const file = await services.memory.publishFile(projectId, data.filename, buffer);

    // Notify in chat
    await services.chat.sendMessage({
      projectId,
      roomId: "coordination",
      senderId: "human_supervisor",
      messageType: "system",
      message: `System: New file [${file.filename}] uploaded to shared memory.`
    });

    return file;
  });

  app.post("/api/memory/approve", async (request, reply) => {
    const parsed = approveMemorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }

    const projectId = parsed.data.projectId ?? "local";
    try {
      const file = await services.memory.approveFile(projectId, parsed.data.filename);
      return file;
    } catch (error) {
      return reply.status(400).send({ error: { code: "APPROVE_FAILED", message: (error as Error).message } });
    }
  });

  // Schedules
  app.post("/api/schedules", async (request, reply) => {
    const schema = z.object({
      projectId: z.string().min(1).optional(),
      agent_id: z.string().min(1),
      session_id: z.string().optional(),
      command: z.string().min(1),
      wakeup_at: z.string().min(1),
      message: z.string().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }
    try {
      const record = await services.schedules.create({
        projectId: parsed.data.projectId,
        agentId: parsed.data.agent_id,
        sessionId: parsed.data.session_id ?? null,
        command: parsed.data.command,
        wakeupAt: parsed.data.wakeup_at,
        message: parsed.data.message ?? null,
      });
      const { SchedulerUtil } = await import("../utils/scheduler.js");
      SchedulerUtil.install({
        id: record.scheduleId,
        agentId: record.agentId,
        command: record.command,
        wakeupAt: record.wakeupAt,
      }).catch((err) => app.log.warn({ err }, "Cron install failed"));
      return toScheduleDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "SCHEDULE_CREATE_FAILED", message: (error as Error).message } });
    }
  });

  app.get("/api/schedules", async (request) => {
    const query = request.query as any;
    const records = await services.schedules.list({
      projectId: query.project_id,
      agentId: query.agent_id,
      status: query.status,
    });
    return records.map(toScheduleDto);
  });

  app.delete("/api/schedules/:id", async (request, reply) => {
    const { id } = request.params as any;
    try {
      const record = await services.schedules.cancel(id);
      const { SchedulerUtil } = await import("../utils/scheduler.js");
      SchedulerUtil.remove(id).catch(() => {});
      return toScheduleDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "SCHEDULE_CANCEL_FAILED", message: (error as Error).message } });
    }
  });

  // Sessions
  app.post("/api/sessions/save", async (request, reply) => {
    const schema = z.object({
      projectId: z.string().min(1).optional(),
      agent_id: z.string().min(1),
      session_id: z.string().optional(),
      summary: z.string().min(1),
      last_task_id: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    }
    try {
      const record = await services.sessions.save({
        projectId: parsed.data.projectId,
        agentId: parsed.data.agent_id,
        sessionId: parsed.data.session_id ?? null,
        summary: parsed.data.summary,
        lastTaskId: parsed.data.last_task_id ?? null,
        metadata: parsed.data.metadata,
      });
      return toSessionSnapshotDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "SESSION_SAVE_FAILED", message: (error as Error).message } });
    }
  });

  app.get("/api/sessions/:agentId/last", async (request) => {
    const { agentId } = request.params as any;
    const record = await services.sessions.restore(agentId);
    return record ? toSessionSnapshotDto(record) : null;
  });

  app.get("/api/projects/:projectId/dashboard/snapshot", async (request) => {
    const { projectId } = request.params as any;
    return services.dashboard.getSnapshot(projectId);
  });

  // Legacy snapshot for backward compatibility
  app.get("/api/dashboard/snapshot", async () => services.dashboard.getSnapshot("local"));

  // Analytics
  app.get("/api/projects/:projectId/analytics", async (request) => {
    const { projectId } = request.params as any;
    return services.dashboard.getAnalytics(projectId);
  });

  // Activity timeline
  app.get("/api/projects/:projectId/activity", async (request) => {
    const { projectId } = request.params as any;
    const query = request.query as any;
    const limit = parseInt(query.limit) || 50;
    return services.dashboard.getActivity(projectId, limit);
  });

  // Goal routes
  app.post("/api/goals", async (request, reply) => {
    try {
      const schema = z.object({
        project_id: z.string().min(1).optional(),
        agent_id: z.string().min(1),
        parent_goal_id: z.string().min(1).nullable().optional(),
        title: z.string().min(1),
        description: z.string().min(1),
        stop_condition: z.string().nullable().optional(),
        max_iterations: z.number().int().positive().nullable().optional(),
      });
      const parsed = schema.parse(request.body);
      const record = await services.goals.start({
        projectId: parsed.project_id,
        agentId: parsed.agent_id,
        parentGoalId: parsed.parent_goal_id ?? null,
        title: parsed.title,
        description: parsed.description,
        stopCondition: parsed.stop_condition ?? null,
        maxIterations: parsed.max_iterations ?? null,
      });
      return reply.status(201).send(toGoalDto(record));
    } catch (error) {
      return reply.status(400).send({ error: { code: "GOAL_START_FAILED", message: (error as Error).message } });
    }
  });

  app.get("/api/goals", async (request) => {
    const query = request.query as any;
    const records = await services.goals.list({
      projectId: query.project_id,
      agentId: query.agent_id,
      status: query.status,
      parentGoalId: query.parent_goal_id ?? undefined,
    });
    return records.map(toGoalDto);
  });

  app.get("/api/goals/:goalId", async (request) => {
    const { goalId } = request.params as any;
    const record = await services.goals.get(goalId);
    return record ? toGoalDto(record) : null;
  });

  app.patch("/api/goals/:goalId", async (request, reply) => {
    try {
      const { goalId } = request.params as any;
      const schema = z.object({
        project_id: z.string().min(1).optional(),
        status: z.string().min(1).optional(),
        progress: z.string().nullable().optional(),
        summary: z.string().nullable().optional(),
      });
      const parsed = schema.parse(request.body);
      const record = await services.goals.update({
        goalId,
        projectId: parsed.project_id,
        status: parsed.status,
        progress: parsed.progress ?? null,
        summary: parsed.summary ?? null,
      });
      return toGoalDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "GOAL_UPDATE_FAILED", message: (error as Error).message } });
    }
  });

  app.post("/api/goals/:goalId/claim", async (request, reply) => {
    try {
      const { goalId } = request.params as any;
      const schema = z.object({ agent_id: z.string().min(1) });
      const parsed = schema.parse(request.body);
      const record = await services.goals.claim(goalId, parsed.agent_id);
      return toGoalDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "GOAL_CLAIM_FAILED", message: (error as Error).message } });
    }
  });

  app.post("/api/goals/:goalId/complete", async (request, reply) => {
    try {
      const { goalId } = request.params as any;
      const schema = z.object({ summary: z.string().nullable().optional() });
      const parsed = schema.parse(request.body ?? {});
      const record = await services.goals.complete(goalId, parsed.summary ?? undefined);
      return toGoalDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "GOAL_COMPLETE_FAILED", message: (error as Error).message } });
    }
  });

  app.post("/api/goals/:goalId/pause", async (request, reply) => {
    try {
      const { goalId } = request.params as any;
      const schema = z.object({ progress: z.string().nullable().optional(), summary: z.string().nullable().optional() });
      const parsed = schema.parse(request.body ?? {});
      const record = await services.goals.pause(goalId, parsed.progress ?? undefined, parsed.summary ?? undefined);
      return toGoalDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "GOAL_PAUSE_FAILED", message: (error as Error).message } });
    }
  });

  app.post("/api/goals/:goalId/increment-iteration", async (request, reply) => {
    try {
      const { goalId } = request.params as any;
      const record = await services.goals.incrementIteration(goalId);
      return toGoalDto(record);
    } catch (error) {
      return reply.status(400).send({ error: { code: "GOAL_INCREMENT_FAILED", message: (error as Error).message } });
    }
  });

  // Subagent routes
  app.get("/api/subagents", async (request) => {
    const query = request.query as any;
    const defs = await services.subagents.list(query.project_root);
    return defs.map(toSubagentDto);
  });

  // Subagent instances (must be before :name routes)
  app.get("/api/subagents/instances", async (request) => {
    const query = request.query as any;
    const instances = await services.subagents.listInstances(query.project_root, query.status);
    return instances.map(toSubagentInstanceDto);
  });

  app.post("/api/subagents/:name/complete", async (request, reply) => {
    try {
      const { name } = request.params as any;
      const query = request.query as any;
      const instance = await services.subagents.completeInstance(name, query.project_root);
      return toSubagentInstanceDto(instance);
    } catch (error) {
      return reply.status(400).send({ error: { code: "COMPLETE_FAILED", message: (error as Error).message } });
    }
  });

  app.post("/api/subagents/:name/fail", async (request, reply) => {
    try {
      const { name } = request.params as any;
      const query = request.query as any;
      const instance = await services.subagents.failInstance(name, query.project_root);
      return toSubagentInstanceDto(instance);
    } catch (error) {
      return reply.status(400).send({ error: { code: "FAIL_FAILED", message: (error as Error).message } });
    }
  });

  app.get("/api/subagents/schemas", async () => {
    const schemas = services.subagents.getAllSchemas();
    return Object.entries(schemas).map(([key, schema]) => ({
      agentType: key,
      format: schema.format,
      nativeDir: schema.nativeDir,
      nativeExt: schema.nativeExt,
      fields: schema.fields,
    }));
  });

  app.get("/api/subagents/schema/:agentType", async (request) => {
    const { agentType } = request.params as any;
    const schema = services.subagents.getSchemaForAgentType(agentType);
    if (!schema) return null;
    return {
      agentType: schema.agentType,
      format: schema.format,
      nativeDir: schema.nativeDir,
      nativeExt: schema.nativeExt,
      fields: schema.fields,
    };
  });

  app.get("/api/subagents/:name", async (request, reply) => {
    const { name } = request.params as any;
    const query = request.query as any;
    const def = await services.subagents.get(name, query.project_root);
    if (!def) return reply.status(404).send({ error: { code: "NOT_FOUND", message: `Subagent "${name}" not found` } });
    return toSubagentDto(def);
  });

  app.post("/api/subagents", async (request, reply) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        agentType: z.string().min(1),
        targetAgentId: z.string().min(1),
        instructions: z.string().min(1),
        fields: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        project_root: z.string().optional(),
      });
      const parsed = schema.parse(request.body);
      const def = await services.subagents.create({
        name: parsed.name,
        agentType: parsed.agentType as any,
        targetAgentId: parsed.targetAgentId,
        instructions: parsed.instructions,
        fields: (parsed.fields || {}) as any,
        configWritten: false,
        configPath: null,
        createdAt: new Date().toISOString(),
      }, parsed.project_root);
      return reply.status(201).send(toSubagentDto(def));
    } catch (error) {
      return reply.status(400).send({ error: { code: "SUBCREATE_FAILED", message: (error as Error).message } });
    }
  });

  app.delete("/api/subagents/:name", async (request, reply) => {
    try {
      const { name } = request.params as any;
      const query = request.query as any;
      await services.subagents.remove(name, query.project_root);
      return { success: true };
    } catch (error) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: (error as Error).message } });
    }
  });

  app.post("/api/subagents/:name/launch", async (request, reply) => {
    try {
      const { name } = request.params as any;
      const query = request.query as any;
      const result = await services.subagents.launch(name, query.project_root);
      return result;
    } catch (error) {
      return reply.status(400).send({ error: { code: "LAUNCH_FAILED", message: (error as Error).message } });
    }
  });

  app.patch("/api/subagents/:name", async (request, reply) => {
    try {
      const { name } = request.params as any;
      const query = request.query as any;
      const schema = z.object({
        targetAgentId: z.string().min(1).optional(),
        instructions: z.string().min(1).optional(),
        fields: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      });
      const parsed = schema.parse(request.body);
      const updated = await services.subagents.update(name, parsed, query.project_root);
      return toSubagentDto(updated);
    } catch (error) {
      return reply.status(400).send({ error: { code: "SUBCREATE_FAILED", message: (error as Error).message } });
    }
  });

  app.post("/api/projects/:projectId/set-root", async (request, reply) => {
    try {
      const { projectId } = request.params as any;
      const schema = z.object({ rootPath: z.string().min(1) });
      const parsed = schema.parse(request.body);
      services.subagents.setProjectRoot(parsed.rootPath);
      return { success: true, rootPath: parsed.rootPath };
    } catch (error) {
      return reply.status(400).send({ error: { code: "SET_ROOT_FAILED", message: (error as Error).message } });
    }
  });

  // File system browser (safe, scoped)
  const BLOCKED_PREFIXES = ["/proc", "/sys", "/dev", "/etc", "/boot", "/tmp"];

  function isSafePath(p: string): boolean {
    const resolved = path.resolve(p);
    for (const prefix of BLOCKED_PREFIXES) {
      if (resolved.startsWith(prefix)) return false;
    }
    return true;
  }

  app.get("/api/fs/list", async (request, reply) => {
    const query = request.query as any;
    const dirPath = query.path ? path.resolve(query.path) : os.homedir();

    if (!isSafePath(dirPath)) {
      return reply.status(403).send({ error: { code: "FORBIDDEN", message: "Cannot browse system directories" } });
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result = entries
        .filter(e => e.name.charAt(0) !== "." || query.showHidden === "true")
        .map(e => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      return { entries: result, currentPath: dirPath, parentPath: path.dirname(dirPath) };
    } catch (error) {
      return reply.status(400).send({ error: { code: "READ_FAILED", message: (error as Error).message } });
    }
  });

  // Create project with init
  app.post("/api/projects/create", async (request, reply) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional().default(""),
        rootPath: z.string().min(1),
        initGit: z.boolean().optional().default(true),
      });
      const parsed = schema.parse(request.body);
      const rootPath = path.resolve(parsed.rootPath);

      // Check if directory already exists and is non-empty
      try {
        const existing = await fs.readdir(rootPath);
        if (existing.length > 0) {
          // Check if it already has .codehive (already a CodeHive project)
          try {
            await fs.access(path.join(rootPath, ".codehive"));
            return reply.status(400).send({
              error: { code: "ALREADY_INITIALIZED", message: "This directory already contains a CodeHive project" }
            });
          } catch {
            // Non-empty but not a CodeHive project — allow it
          }
        }
      } catch {
        // Directory doesn't exist yet — will be created
      }

      const projectId = parsed.name.toLowerCase().replace(/[^a-z0-9]/g, "-");

      const { events } = services;

      // Kick off init in background
      initializeProject({
        name: parsed.name,
        description: parsed.description,
        rootPath,
        initGit: parsed.initGit,
        callbacks: {
          onStep: (step, status, message) => {
            events.emit("project_init_step", { step, status, message, projectId } as any);
          },
          getMasterKey: async () => {
            const { getTrustedKey } = await import("./auth.js");
            return getTrustedKey();
          },
          registerProject: async (pid, pname, pdesc, masterKey) => {
            try {
              await services.prisma.project.upsert({
                where: { id: pid },
                create: { id: pid, name: pname, description: pdesc, apiKey: masterKey },
                update: { name: pname, description: pdesc },
              });
              return true;
            } catch {
              return false;
            }
          },
          registerAgent: async (agentId, agentName, provider, masterKey) => {
            try {
              await services.agents.registerAgent({
                projectId,
                agentId,
                name: agentName,
                provider,
                role: "assistant",
              });
              return true;
            } catch {
              return false;
            }
          },
        },
      }).then((result) => {
        events.emit("project_init_done", { projectId: result.projectId, name: parsed.name, rootPath } as any);
      }).catch((err) => {
        events.emit("project_init_error", { error: (err as Error).message } as any);
        app.log.error({ err }, "Project init failed");
      });

      return reply.status(201).send({ projectId, name: parsed.name, rootPath });
    } catch (error) {
      return reply.status(400).send({ error: { code: "CREATE_FAILED", message: (error as Error).message } });
    }
  });

  app.get("/ws", { websocket: true }, (connection, req) => {
    app.log.info("New WebSocket connection established");
    handleWebsocket(connection, req, services);
  });
}
