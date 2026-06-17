import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  DEFAULT_MESSAGE_LIMIT,
  DEFAULT_ROOM_ID,
  MAX_MESSAGE_LIMIT
} from "../config/defaults.js";
import type { DomainServices } from "../domain/services.js";
import { 
  toAgentDto, 
  toMessageDto, 
  toTaskDto, 
  toFileClaimDto, 
  toDecisionDto 
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

const publishMemorySchema = z.object({
  projectId: z.string().min(1).optional(),
  filename: z.string().min(1),
  content: z.string().min(1)
});

export async function registerRoutes(
  app: FastifyInstance,
  services: DomainServices
): Promise<void> {
  app.get("/health", async () => ({
    status: "ok"
  }));

  // Projects
  app.get("/api/projects", async () => {
    const projects = await services.prisma.project.findMany({
      orderBy: { createdAt: "desc" }
    });
    return { projects };
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
    const agentId = parsed.data.agent_id ?? parsed.data.agentId;
    const projectId = parsed.data.projectId ?? "local";

    if (!taskId || !agentId) {
      return reply.status(400).send({ error: { code: "MISSING_ID", message: "taskId and agentId are required" } });
    }

    const task = await services.tasks.startTask({
      projectId,
      taskId,
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
      const content = await services.memory.readFile(projectId, filename);
      return { filename, content };
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

  app.get("/api/projects/:projectId/dashboard/snapshot", async (request) => {
    const { projectId } = request.params as any;
    return services.dashboard.getSnapshot(projectId);
  });

  // Legacy snapshot for backward compatibility
  app.get("/api/dashboard/snapshot", async () => services.dashboard.getSnapshot("local"));

  app.get("/ws", { websocket: true }, (connection, req) => {
    app.log.info("New WebSocket connection established");
    handleWebsocket(connection, req, services);
  });
}
