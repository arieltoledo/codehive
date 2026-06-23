import type { PrismaClient, Goal } from "@prisma/client";

import type { EventBus } from "./events.js";
import type { GoalRecord, StartGoalInput, UpdateGoalInput } from "./types.js";

function toRecord(g: Goal): GoalRecord {
  return {
    goalId: g.id,
    projectId: g.projectId,
    agentId: g.agentId,
    parentGoalId: g.parentGoalId,
    title: g.title,
    description: g.description,
    stopCondition: g.stopCondition,
    status: g.status,
    progress: g.progress,
    lastSummary: g.lastSummary,
    maxIterations: g.maxIterations,
    iterationCount: g.iterationCount,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    finishedAt: g.finishedAt,
  };
}

export class GoalService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus,
  ) {}

  async start(input: StartGoalInput): Promise<GoalRecord> {
    const projectId = input.projectId ?? "local";

    if (input.parentGoalId) {
      const parent = await this.prisma.goal.findUnique({ where: { id: input.parentGoalId } });
      if (!parent) throw new Error(`Parent goal ${input.parentGoalId} not found`);
    }

    const g = await this.prisma.goal.create({
      data: {
        projectId,
        agentId: input.agentId,
        parentGoalId: input.parentGoalId ?? null,
        title: input.title,
        description: input.description,
        stopCondition: input.stopCondition ?? null,
        maxIterations: input.maxIterations ?? null,
        status: "in_progress",
      },
    });

    const record = toRecord(g);
    this.events?.emit("goal_started", record);
    return record;
  }

  async update(input: UpdateGoalInput): Promise<GoalRecord> {
    const projectId = input.projectId ?? "local";
    const data: any = {};

    if (input.status) data.status = input.status;
    if (input.progress !== undefined) data.progress = input.progress;
    if (input.summary !== undefined) data.lastSummary = input.summary;
    if (input.status === "completed" || input.status === "failed") {
      data.finishedAt = new Date();
    }

    const g = await this.prisma.goal.update({
      where: { id: input.goalId },
      data,
    });

    const record = toRecord(g);
    const eventType = input.status === "completed"
      ? "goal_completed"
      : input.status === "paused"
        ? "goal_paused"
        : "goal_updated";
    this.events?.emit(eventType, record);
    return record;
  }

  async complete(goalId: string, summary?: string): Promise<GoalRecord> {
    return this.update({ goalId, status: "completed", summary: summary ?? null });
  }

  async pause(goalId: string, progress?: string, summary?: string): Promise<GoalRecord> {
    return this.update({ goalId, status: "paused", progress: progress ?? null, summary: summary ?? null });
  }

  async claim(goalId: string, newAgentId: string): Promise<GoalRecord> {
    const g = await this.prisma.goal.update({
      where: { id: goalId },
      data: { agentId: newAgentId },
    });
    const record = toRecord(g);
    this.events?.emit("goal_claimed", record);
    return record;
  }

  async list(options: {
    projectId?: string;
    agentId?: string;
    status?: string;
    parentGoalId?: string | null;
  }): Promise<GoalRecord[]> {
    const where: any = {};
    if (options.projectId) where.projectId = options.projectId;
    if (options.agentId) where.agentId = options.agentId;
    if (options.status) where.status = options.status;
    if (options.parentGoalId !== undefined) where.parentGoalId = options.parentGoalId;

    const rows = await this.prisma.goal.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
    });
    return rows.map(toRecord);
  }

  async get(goalId: string): Promise<GoalRecord | null> {
    const g = await this.prisma.goal.findUnique({ where: { id: goalId } });
    return g ? toRecord(g) : null;
  }

  async incrementIteration(goalId: string): Promise<GoalRecord> {
    const g = await this.prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    const count = g.iterationCount + 1;

    if (g.maxIterations && count >= g.maxIterations) {
      return this.update({ goalId, status: "paused", summary: `max_iterations (${g.maxIterations}) reached` });
    }

    const updated = await this.prisma.goal.update({
      where: { id: goalId },
      data: { iterationCount: count },
    });
    return toRecord(updated);
  }
}
