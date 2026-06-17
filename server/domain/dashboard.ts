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

  async getSnapshot(projectId: string = "local", limit = DEFAULT_MESSAGE_LIMIT) {
    const [agents, messages, tasks, fileClaims, decisions] = await Promise.all([
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
      })
    ]);

    return {
      agents: agents.map(toAgentDto),
      messages: messages.map(toMessageDto),
      active_tasks: tasks.map(toTaskDto),
      file_claims: fileClaims.map(toFileClaimDto),
      decisions: decisions.map(toDecisionDto)
    };
  }
}
