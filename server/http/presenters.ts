import type { Decision, FileClaim, Task } from "@prisma/client";

import type { AgentRecord, MessageRecord } from "../domain/types.js";

export interface AgentDto {
  agent_id: string;
  name: string;
  provider: string;
  role: string;
  parent_agent_id: string | null;
  status: string;
  current_task_id: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface MessageDto {
  message_id: string;
  room_id: string;
  sender_id: string;
  sender_type: string;
  message_type: string;
  message: string;
  task_id: string | null;
  created_at: string;
}

export function toAgentDto(agent: AgentRecord): AgentDto {
  return {
    agent_id: agent.agentId,
    name: agent.name,
    provider: agent.provider,
    role: agent.role,
    parent_agent_id: agent.parentAgentId,
    status: agent.status,
    current_task_id: agent.currentTaskId,
    last_seen_at: agent.lastSeenAt.toISOString(),
    created_at: agent.createdAt.toISOString()
  };
}

export function toMessageDto(message: MessageRecord): MessageDto {
  return {
    message_id: message.messageId,
    room_id: message.roomId,
    sender_id: message.senderId,
    sender_type: message.senderType,
    message_type: message.messageType,
    message: message.message,
    task_id: message.taskId,
    created_at: message.createdAt.toISOString()
  };
}

export function toTaskDto(task: any) {
  return {
    task_id: task.id ?? task.taskId,
    title: task.title,
    description: task.description,
    status: task.status,
    assigned_agent_id: task.assignedAgentId,
    created_at: task.createdAt.toISOString(),
    updated_at: task.updatedAt.toISOString(),
    finished_at: task.finishedAt?.toISOString() ?? null
  };
}

export function toFileClaimDto(fileClaim: FileClaim) {
  return {
    claim_id: fileClaim.id,
    agent_id: fileClaim.agentId,
    task_id: fileClaim.taskId,
    file_path: fileClaim.filePath,
    status: fileClaim.status,
    reason: fileClaim.reason,
    created_at: fileClaim.createdAt.toISOString(),
    released_at: fileClaim.releasedAt?.toISOString() ?? null
  };
}

export function toDecisionDto(decision: Decision) {
  return {
    decision_id: decision.id,
    agent_id: decision.agentId,
    task_id: decision.taskId,
    decision: decision.decision,
    reason: decision.reason,
    created_at: decision.createdAt.toISOString()
  };
}
