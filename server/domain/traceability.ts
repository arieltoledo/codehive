import type { Decision, FileClaim, PrismaClient } from "@prisma/client";

import { DomainError } from "./errors.js";
import type { EventBus } from "./events.js";
import type {
  ClaimFileInput,
  DecisionRecord,
  FileClaimRecord,
  RecordDecisionInput,
  ReleaseFileInput
} from "./types.js";

function toFileClaimRecord(claim: FileClaim): FileClaimRecord {
  return {
    claimId: claim.id,
    projectId: claim.projectId,
    agentId: claim.agentId,
    taskId: claim.taskId,
    filePath: claim.filePath,
    status: claim.status,
    reason: claim.reason,
    createdAt: claim.createdAt,
    releasedAt: claim.releasedAt
  };
}

function toDecisionRecord(decision: Decision): DecisionRecord {
  return {
    decisionId: decision.id,
    projectId: decision.projectId,
    agentId: decision.agentId,
    taskId: decision.taskId,
    decision: decision.decision,
    reason: decision.reason,
    createdAt: decision.createdAt
  };
}

export class TraceabilityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus
  ) {}

  async claimFile(input: ClaimFileInput): Promise<FileClaimRecord> {
    const projectId = input.projectId ?? "local";

    const agentExists = await this.prisma.agent.count({
      where: { id: input.agentId }
    });

    if (!agentExists) {
      throw new DomainError(
        "AGENT_NOT_FOUND",
        `Cannot claim file for unknown agent '${input.agentId}'.`,
        404
      );
    }

    // Ensure project exists
    await this.prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: { id: projectId, name: projectId }
    });

    const claim = await this.prisma.fileClaim.create({
      data: {
        agentId: input.agentId,
        projectId,
        filePath: input.filePath,
        taskId: input.taskId ?? null,
        reason: input.reason,
        status: "active"
      }
    });

    const record = toFileClaimRecord(claim);
    this.events?.emit("file_claimed", record);
    return record;
  }

  async releaseFile(input: ReleaseFileInput): Promise<FileClaimRecord> {
    const activeClaim = await this.prisma.fileClaim.findFirst({
      where: {
        agentId: input.agentId,
        filePath: input.filePath,
        status: "active"
      },
      orderBy: { createdAt: "desc" }
    });

    if (!activeClaim) {
      throw new DomainError(
        "CLAIM_NOT_FOUND",
        `No active claim found for agent '${input.agentId}' and file '${input.filePath}'.`,
        404
      );
    }

    const releasedClaim = await this.prisma.fileClaim.update({
      where: { id: activeClaim.id },
      data: {
        status: "released",
        releasedAt: new Date()
      }
    });

    const record = toFileClaimRecord(releasedClaim);
    this.events?.emit("file_released", record);
    return record;
  }

  async recordDecision(input: RecordDecisionInput): Promise<DecisionRecord> {
    const projectId = input.projectId ?? "local";

    const agentExists = await this.prisma.agent.count({
      where: { id: input.agentId }
    });

    if (!agentExists) {
      throw new DomainError(
        "AGENT_NOT_FOUND",
        `Cannot record decision for unknown agent '${input.agentId}'.`,
        404
      );
    }

    // Ensure project exists
    await this.prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: { id: projectId, name: projectId }
    });

    const decision = await this.prisma.decision.create({
      data: {
        agentId: input.agentId,
        projectId,
        taskId: input.taskId ?? null,
        decision: input.decision,
        reason: input.reason
      }
    });

    const record = toDecisionRecord(decision);
    this.events?.emit("decision_recorded", record);
    return record;
  }
}
