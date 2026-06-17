import type { Agent, PrismaClient } from "@prisma/client";

import type { EventBus } from "./events.js";
import type { AgentRecord, AgentStatus, RegisterAgentInput } from "./types.js";

function toAgentRecord(agent: Agent): AgentRecord {
  return {
    projectId: agent.projectId,
    agentId: agent.id,
    name: agent.name,
    provider: agent.provider,
    role: agent.role,
    parentAgentId: agent.parentAgentId,
    status: agent.status,
    currentTaskId: agent.currentTaskId,
    lastSeenAt: agent.lastSeenAt,
    createdAt: agent.createdAt
  };
}

export class AgentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus
  ) {}

  async registerAgent(input: RegisterAgentInput): Promise<AgentRecord> {
    const now = new Date();
    const projectId = input.projectId ?? "local";
    
    // Ensure project exists
    await this.prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: { id: projectId, name: projectId }
    });

    const isNew = !(await this.exists(input.agentId));
    const agent = await this.prisma.agent.upsert({
      where: { id: input.agentId },
      create: {
        id: input.agentId,
        projectId,
        name: input.name,
        provider: input.provider,
        role: input.role,
        parentAgentId: input.parentAgentId ?? null,
        status: "idle",
        lastSeenAt: now
      },
      update: {
        name: input.name,
        provider: input.provider,
        role: input.role,
        parentAgentId: input.parentAgentId ?? null,
        lastSeenAt: now
      }
    });

    const record = toAgentRecord(agent);
    if (isNew) {
      this.events?.emit("agent_registered", record);
    } else {
      this.events?.emit("agent_updated", record);
    }
    return record;
  }

  async updateStatus(agentId: string, status: AgentStatus): Promise<AgentRecord> {
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { status, lastSeenAt: new Date() }
    });

    const record = toAgentRecord(agent);
    this.events?.emit("agent_updated", record);
    return record;
  }

  async listAgents(projectId?: string): Promise<AgentRecord[]> {
    const agents = await this.prisma.agent.findMany({
      where: projectId ? { projectId } : {},
      orderBy: [{ lastSeenAt: "desc" }, { id: "asc" }]
    });

    return agents.map(toAgentRecord);
  }

  async exists(agentId: string): Promise<boolean> {
    const count = await this.prisma.agent.count({ where: { id: agentId } });
    return count > 0;
  }

  async touch(agentId: string): Promise<void> {
    await this.prisma.agent.updateMany({
      where: { id: agentId },
      data: { lastSeenAt: new Date() }
    });
  }
}
