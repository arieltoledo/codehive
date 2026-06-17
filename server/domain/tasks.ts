import type { PrismaClient, Task } from "@prisma/client";

import { DomainError } from "./errors.js";
import type { EventBus } from "./events.js";
import type { FinishTaskInput, StartTaskInput, TaskRecord } from "./types.js";

function toTaskRecord(task: Task): TaskRecord {
  return {
    projectId: task.projectId,
    taskId: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    assignedAgentId: task.assignedAgentId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    finishedAt: task.finishedAt
  };
}

export class TaskService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus
  ) {}

  async startTask(input: StartTaskInput): Promise<TaskRecord> {
    const projectId = input.projectId ?? "local";

    const agentExists = await this.prisma.agent.count({
      where: { id: input.agentId }
    });

    if (!agentExists) {
      throw new DomainError(
        "AGENT_NOT_FOUND",
        `Cannot start task for unknown agent '${input.agentId}'.`,
        404
      );
    }

    // Ensure project exists
    await this.prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: { id: projectId, name: projectId }
    });

    const task = await this.prisma.task.upsert({
      where: { id: input.taskId },
      create: {
        id: input.taskId,
        projectId,
        title: input.title,
        description: input.description,
        status: "running",
        assignedAgentId: input.agentId
      },
      update: {
        title: input.title,
        description: input.description,
        status: "running",
        assignedAgentId: input.agentId,
        finishedAt: null
      }
    });

    await this.prisma.agent.update({
      where: { id: input.agentId },
      data: {
        currentTaskId: task.id,
        status: "working",
        lastSeenAt: new Date()
      }
    });

    const record = toTaskRecord(task);
    this.events?.emit("task_started", record);
    return record;
  }

  async finishTask(input: FinishTaskInput): Promise<TaskRecord> {
    const existing = await this.prisma.task.findUnique({
      where: { id: input.taskId }
    });

    if (!existing) {
      throw new DomainError(
        "TASK_NOT_FOUND",
        `Cannot finish unknown task '${input.taskId}'.`,
        404
      );
    }

    const task = await this.prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        finishedAt: new Date()
      }
    });

    await this.prisma.agent.update({
      where: { id: task.assignedAgentId },
      data: {
        currentTaskId: null,
        status: "idle",
        lastSeenAt: new Date()
      }
    });

    const record = toTaskRecord(task);
    this.events?.emit("task_finished", record);
    return record;
  }
}
