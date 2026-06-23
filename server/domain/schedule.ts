import type { PrismaClient, Schedule } from "@prisma/client";

import type { EventBus } from "./events.js";
import type { CreateScheduleInput, ScheduleRecord } from "./types.js";

function toRecord(s: Schedule): ScheduleRecord {
  return {
    scheduleId: s.id,
    projectId: s.projectId,
    agentId: s.agentId,
    sessionId: s.sessionId,
    command: s.command,
    wakeupAt: s.wakeupAt,
    message: s.message,
    status: s.status,
    createdAt: s.createdAt,
    executedAt: s.executedAt,
  };
}

export class ScheduleService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus,
  ) {}

  async create(input: CreateScheduleInput): Promise<ScheduleRecord> {
    const wakeupAt = new Date(input.wakeupAt);
    const projectId = input.projectId ?? "local";

    const s = await this.prisma.schedule.create({
      data: {
        projectId,
        agentId: input.agentId,
        sessionId: input.sessionId ?? null,
        command: input.command,
        wakeupAt,
        message: input.message ?? null,
        status: "pending",
      },
    });

    const record = toRecord(s);
    this.events?.emit("schedule_created", record);
    return record;
  }

  async list(options: {
    projectId?: string;
    agentId?: string;
    status?: string;
  }): Promise<ScheduleRecord[]> {
    const where: any = {};
    if (options.projectId) where.projectId = options.projectId;
    if (options.agentId) where.agentId = options.agentId;
    if (options.status) where.status = options.status;

    const rows = await this.prisma.schedule.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async cancel(scheduleId: string): Promise<ScheduleRecord> {
    const s = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: "cancelled" },
    });
    const record = toRecord(s);
    this.events?.emit("schedule_cancelled", record);
    return record;
  }

  async markCompleted(scheduleId: string): Promise<ScheduleRecord> {
    const s = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: "completed", executedAt: new Date() },
    });
    const record = toRecord(s);
    this.events?.emit("schedule_completed", record);
    return record;
  }

  async processDueSchedules(): Promise<ScheduleRecord[]> {
    const due = await this.prisma.schedule.findMany({
      where: {
        status: "pending",
        wakeupAt: { lte: new Date() },
      },
    });

    const completed: ScheduleRecord[] = [];
    for (const s of due) {
      completed.push(await this.markCompleted(s.id));
    }
    return completed;
  }
}
