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

import type { GoalRecord, ScheduleRecord, SessionSnapshotRecord } from "../domain/types.js";

export interface ScheduleDto {
  schedule_id: string;
  project_id: string;
  agent_id: string;
  session_id: string | null;
  command: string;
  wakeup_at: string;
  message: string | null;
  status: string;
  created_at: string;
  executed_at: string | null;
}

export interface SessionSnapshotDto {
  snapshot_id: string;
  project_id: string;
  agent_id: string;
  session_id: string | null;
  summary: string;
  last_task_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function toScheduleDto(s: ScheduleRecord): ScheduleDto {
  return {
    schedule_id: s.scheduleId,
    project_id: s.projectId,
    agent_id: s.agentId,
    session_id: s.sessionId,
    command: s.command,
    wakeup_at: s.wakeupAt.toISOString(),
    message: s.message,
    status: s.status,
    created_at: s.createdAt.toISOString(),
    executed_at: s.executedAt?.toISOString() ?? null,
  };
}

export function toSessionSnapshotDto(s: SessionSnapshotRecord): SessionSnapshotDto {
  return {
    snapshot_id: s.snapshotId,
    project_id: s.projectId,
    agent_id: s.agentId,
    session_id: s.sessionId,
    summary: s.summary,
    last_task_id: s.lastTaskId,
    metadata: s.metadata,
    created_at: s.createdAt.toISOString(),
  };
}

export interface GoalDto {
  goalId: string;
  projectId: string;
  agentId: string;
  parentGoalId: string | null;
  title: string;
  description: string;
  stopCondition: string | null;
  status: string;
  progress: string | null;
  lastSummary: string | null;
  maxIterations: number | null;
  iterationCount: number;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

export function toGoalDto(g: GoalRecord): GoalDto {
  return {
    goalId: g.goalId,
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

import type { SubagentDef, SubagentInstanceRecord } from "../domain/types.js";

export interface SubagentDto {
  name: string;
  agentType: string;
  targetAgentId: string;
  instructions: string;
  fields: Record<string, string | number | boolean | undefined>;
  configWritten: boolean;
  configPath: string | null;
  createdAt: string;
}

export function toSubagentDto(def: SubagentDef): SubagentDto {
  return {
    name: def.name,
    agentType: def.agentType,
    targetAgentId: def.targetAgentId,
    instructions: def.instructions,
    fields: def.fields,
    configWritten: def.configWritten,
    configPath: def.configPath,
    createdAt: def.createdAt,
  };
}

export interface SubagentSchemaDto {
  agentType: string;
  format: string;
  nativeDir: string;
  nativeExt: string;
  fields: Array<{ name: string; label: string; type: string; required?: boolean; options?: string[] }>;
}

export interface SubagentInstanceDto {
  id: string;
  project_id: string;
  subagent_name: string;
  agent_type: string;
  target_agent_id: string;
  status: string;
  created_at: string;
  finished_at: string | null;
}

export function toSubagentInstanceDto(inst: SubagentInstanceRecord): SubagentInstanceDto {
  return {
    id: inst.id,
    project_id: inst.projectId,
    subagent_name: inst.subagentName,
    agent_type: inst.agentType,
    target_agent_id: inst.targetAgentId,
    status: inst.status,
    created_at: inst.createdAt.toISOString(),
    finished_at: inst.finishedAt?.toISOString() ?? null,
  };
}
