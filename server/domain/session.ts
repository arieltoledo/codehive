import type { PrismaClient, SessionSnapshot } from "@prisma/client";

import type { EventBus } from "./events.js";
import type { SaveSessionInput, SessionSnapshotRecord } from "./types.js";

function toRecord(s: SessionSnapshot): SessionSnapshotRecord {
  return {
    snapshotId: s.id,
    projectId: s.projectId,
    agentId: s.agentId,
    sessionId: s.sessionId,
    summary: s.summary,
    lastTaskId: s.lastTaskId,
    metadata: JSON.parse(s.metadata),
    createdAt: s.createdAt,
  };
}

export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus,
  ) {}

  async save(input: SaveSessionInput): Promise<SessionSnapshotRecord> {
    const projectId = input.projectId ?? "local";

    const s = await this.prisma.sessionSnapshot.create({
      data: {
        projectId,
        agentId: input.agentId,
        sessionId: input.sessionId ?? null,
        summary: input.summary,
        lastTaskId: input.lastTaskId ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });

    const record = toRecord(s);
    this.events?.emit("session_saved", record);
    return record;
  }

  async restore(agentId: string): Promise<SessionSnapshotRecord | null> {
    const s = await this.prisma.sessionSnapshot.findFirst({
      where: { agentId },
      orderBy: { createdAt: "desc" },
    });
    return s ? toRecord(s) : null;
  }

  async list(agentId: string): Promise<SessionSnapshotRecord[]> {
    const rows = await this.prisma.sessionSnapshot.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map(toRecord);
  }
}
