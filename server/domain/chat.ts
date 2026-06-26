import type { Message, PrismaClient } from "@prisma/client";

import { DEFAULT_PROJECT_ID } from "../config/defaults.js";
import { DomainError } from "./errors.js";
import { AgentService } from "./agents.js";
import type { EventBus } from "./events.js";
import type { MessageRecord, ReadMessagesInput, SendMessageInput } from "./types.js";

function toMessageRecord(message: Message): MessageRecord {
  return {
    messageId: message.id,
    projectId: (message as any).room?.projectId ?? "local",
    roomId: message.roomId,
    senderId: message.senderId,
    senderType: message.senderType,
    messageType: message.messageType,
    message: message.content,
    taskId: message.taskId,
    createdAt: message.createdAt
  };
}

export class ChatService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly agents: AgentService,
    private readonly events?: EventBus
  ) {}

  private qualifyRoomId(roomId: string, projectId: string): string {
    return `${roomId}::${projectId}`;
  }

  async sendMessage(input: SendMessageInput): Promise<MessageRecord> {
    if (input.senderId !== 'human_supervisor' && !(await this.agents.exists(input.senderId))) {
      throw new DomainError(
        "AGENT_NOT_FOUND",
        `Cannot send chat message for unknown agent '${input.senderId}'.`,
        404
      );
    }

    const projectId = input.projectId ?? DEFAULT_PROJECT_ID;
    const qualifiedRoomId = this.qualifyRoomId(input.roomId, projectId);
    await this.ensureRoom(input.roomId, projectId);

    const message = await this.prisma.message.create({
      data: {
        roomId: qualifiedRoomId,
        senderId: input.senderId,
        senderType: input.senderId === 'human_supervisor' ? 'human' : 'agent',
        messageType: input.messageType,
        content: input.message,
        taskId: input.taskId ?? null
      },
      include: {
        room: true
      }
    });

    if (input.senderId !== 'human_supervisor') {
      await this.agents.touch(input.senderId);
    }
    const record = toMessageRecord(message);
    this.events?.emit("message_sent", record);
    return record;
  }

  async readMessages(input: ReadMessagesInput): Promise<MessageRecord[]> {
    const projectId = input.projectId ?? DEFAULT_PROJECT_ID;
    
    if (input.roomId) {
      const qualifiedRoomId = this.qualifyRoomId(input.roomId, projectId);
      await this.ensureRoom(input.roomId, projectId);

      const messages = await this.prisma.message.findMany({
        where: { roomId: qualifiedRoomId },
        include: { room: true },
        orderBy: { createdAt: "desc" },
        take: input.limit
      });
      return messages.map(toMessageRecord);
    }

    const messages = await this.prisma.message.findMany({
      where: {
        room: { projectId }
      },
      include: { room: true },
      orderBy: { createdAt: "desc" },
      take: input.limit
    });

    return messages.map(toMessageRecord);
  }

  private async ensureRoom(roomId: string, projectId: string): Promise<void> {
    // Ensure project exists first
    await this.prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: { id: projectId, name: projectId }
    });

    const qualifiedId = this.qualifyRoomId(roomId, projectId);

    await this.prisma.room.upsert({
      where: { id: qualifiedId },
      create: {
        id: qualifiedId,
        projectId,
        name: roomId
      },
      update: {}
    });
  }
}
