import type { PrismaClient } from "@prisma/client";

import { DEFAULT_MESSAGE_LIMIT, DEFAULT_ROOM_ID } from "../config/defaults.js";
import {
  toAgentDto,
  toDecisionDto,
  toFileClaimDto,
  toMessageDto,
  toTaskDto
} from "../http/presenters.js";
import { AgentService } from "./agents.js";
import { ChatService } from "./chat.js";

export class DashboardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly agents: AgentService,
    private readonly chat: ChatService
  ) {}

  async getAnalytics(projectId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rooms = await this.prisma.room.findMany({ where: { projectId }, select: { id: true } });
    const roomIds = rooms.map(r => r.id);

    const [agents, goals, activeTasks, finishedTodayCount, msgTotal, msgToday, schedules, decisions] = await Promise.all([
      this.prisma.agent.findMany({ where: { projectId } }),
      this.prisma.goal.findMany({ where: { projectId } }),
      this.prisma.task.findMany({ where: { projectId, finishedAt: null } }),
      this.prisma.task.count({ where: { projectId, finishedAt: { gte: today } } }),
      roomIds.length ? this.prisma.message.count({ where: { roomId: { in: roomIds } } }) : Promise.resolve(0),
      roomIds.length ? this.prisma.message.count({ where: { roomId: { in: roomIds }, createdAt: { gte: today } } }) : Promise.resolve(0),
      this.prisma.schedule.findMany({ where: { projectId } }),
      this.prisma.decision.count({ where: { projectId } }),
    ]);

    const agentStatus: Record<string, number> = { total: agents.length };
    for (const a of agents) {
      agentStatus[a.status] = (agentStatus[a.status] || 0) + 1;
    }

    const goalStatus = { total: goals.length, in_progress: 0, paused: 0, completed: 0 };
    for (const g of goals) {
      if (g.status === 'completed') goalStatus.completed++;
      else if (g.status === 'paused') goalStatus.paused++;
      else goalStatus.in_progress++;
    }

    const scheduleStatus = { pending: 0, completed: 0 };
    for (const s of schedules) {
      if (s.status === 'completed') scheduleStatus.completed++;
      else scheduleStatus.pending++;
    }

    return {
      agents: agentStatus,
      goals: goalStatus,
      tasks: { active: activeTasks.length, finishedToday: finishedTodayCount },
      messages: { total: msgTotal, today: msgToday },
      schedules: scheduleStatus,
      decisions,
    };
  }

  async getActivity(projectId: string, limit = 50) {
    const rooms = await this.prisma.room.findMany({ where: { projectId }, select: { id: true } });
    const roomIds = rooms.map(r => r.id);

    const [goals, tasks, decisions, messages] = await Promise.all([
      this.prisma.goal.findMany({ where: { projectId }, orderBy: { updatedAt: 'desc' }, take: limit }),
      this.prisma.task.findMany({ where: { projectId }, orderBy: { updatedAt: 'desc' }, take: limit }),
      this.prisma.decision.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: limit }),
      roomIds.length
        ? this.prisma.message.findMany({
            where: { roomId: { in: roomIds }, senderId: { not: 'human_supervisor' } },
            orderBy: { createdAt: 'desc' }, take: limit
          })
        : Promise.resolve([]),
    ]);

    const items = [
      ...goals.map(g => ({
        id: g.id, type: 'goal', status: g.status,
        agentId: g.agentId, summary: g.title,
        timestamp: g.updatedAt.toISOString()
      })),
      ...tasks.map(t => ({
        id: t.id, type: 'task', status: t.finishedAt ? 'finished' : 'running',
        agentId: t.assignedAgentId ?? 'unknown', summary: t.title,
        timestamp: t.updatedAt.toISOString()
      })),
      ...decisions.map(d => ({
        id: d.id, type: 'decision', status: 'recorded',
        agentId: d.agentId, summary: d.decision.substring(0, 100),
        timestamp: d.createdAt.toISOString()
      })),
      ...messages.map(m => ({
        id: m.id, type: 'message', status: m.messageType ?? 'status',
        agentId: m.senderId, summary: m.content.substring(0, 100),
        timestamp: m.createdAt.toISOString()
      })),
    ];

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, limit);
  }

  async getSnapshot(projectId: string = "local", limit = DEFAULT_MESSAGE_LIMIT) {
    const [agents, messages, tasks, fileClaims, decisions, goals] = await Promise.all([
      this.agents.listAgents(projectId),
      this.chat.readMessages({ projectId, limit }),
      this.prisma.task.findMany({
        where: { projectId, finishedAt: null },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
      }),
      this.prisma.fileClaim.findMany({
        where: { projectId, status: "claimed" },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }]
      }),
      this.prisma.decision.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 25
      }),
      this.prisma.goal.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }),
    ]);

    return {
      agents: agents.map(toAgentDto),
      messages: messages.map(toMessageDto),
      active_tasks: tasks.map(toTaskDto),
      file_claims: fileClaims.map(toFileClaimDto),
      decisions: decisions.map(toDecisionDto),
      goals: goals.map(g => ({
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
      })),
    };
  }
}
