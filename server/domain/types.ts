export type AgentStatus =
  | "idle"
  | "working"
  | "blocked"
  | "waiting_human"
  | "done"
  | "error"
  | "offline";

export interface RegisterAgentInput {
  projectId?: string;
  agentId: string;
  name: string;
  provider: string;
  role: string;
  parentAgentId?: string | null;
}

export interface AgentRecord {
  projectId: string;
  agentId: string;
  name: string;
  provider: string;
  role: string;
  parentAgentId: string | null;
  status: string;
  currentTaskId: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface SendMessageInput {
  projectId?: string;
  roomId: string;
  senderId: string;
  message: string;
  messageType: string;
  taskId?: string | null;
}

export interface ReadMessagesInput {
  projectId?: string;
  roomId?: string;
  limit: number;
}

export interface MessageRecord {
  messageId: string;
  projectId: string;
  roomId: string;
  senderId: string;
  senderType: string;
  messageType: string;
  message: string;
  taskId: string | null;
  createdAt: Date;
}

export interface TaskRecord {
  projectId: string;
  taskId: string;
  parentTaskId: string | null;
  title: string;
  description: string;
  status: string;
  assignedAgentId: string;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

export interface StartTaskInput {
  projectId?: string;
  taskId: string;
  parentTaskId?: string | null;
  agentId: string;
  title: string;
  description: string;
}

export interface FinishTaskInput {
  projectId?: string;
  taskId: string;
  status: "done" | "error";
}

export interface FileClaimRecord {
  claimId: string;
  projectId: string;
  agentId: string;
  taskId: string | null;
  filePath: string;
  status: string;
  reason: string;
  createdAt: Date;
  releasedAt: Date | null;
}

export interface DecisionRecord {
  decisionId: string;
  projectId: string;
  agentId: string;
  taskId: string | null;
  decision: string;
  reason: string;
  createdAt: Date;
}

export interface ClaimFileInput {
  projectId?: string;
  agentId: string;
  filePath: string;
  taskId?: string | null;
  reason: string;
}

export interface ReleaseFileInput {
  projectId?: string;
  agentId: string;
  filePath: string;
}

export interface RecordDecisionInput {
  projectId?: string;
  agentId: string;
  decision: string;
  reason: string;
  taskId?: string | null;
}

export interface ScheduleRecord {
  scheduleId: string;
  projectId: string;
  agentId: string;
  sessionId: string | null;
  command: string;
  wakeupAt: Date;
  message: string | null;
  status: string;
  createdAt: Date;
  executedAt: Date | null;
}

export interface CreateScheduleInput {
  projectId?: string;
  agentId: string;
  sessionId?: string | null;
  command: string;
  wakeupAt: string;
  message?: string | null;
}

export interface SessionSnapshotRecord {
  snapshotId: string;
  projectId: string;
  agentId: string;
  sessionId: string | null;
  summary: string;
  lastTaskId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SaveSessionInput {
  projectId?: string;
  agentId: string;
  sessionId?: string | null;
  summary: string;
  lastTaskId?: string | null;
  metadata?: Record<string, unknown>;
}

export type AgentType = "codex" | "claude-code" | "opencode" | "antigravity" | "generic";

export interface SubagentFieldDef {
  name: string;
  label: string;
  type: "string" | "textarea" | "select" | "number";
  required?: boolean;
  options?: string[];
}

export interface SubagentSchema {
  agentType: AgentType;
  format: "json" | "toml" | "markdown";
  nativeDir: string;
  nativeExt: string;
  fields: SubagentFieldDef[];
}

export interface SubagentDef {
  name: string;
  agentType: AgentType;
  targetAgentId: string;
  instructions: string;
  fields: Record<string, string | number | boolean | undefined>;
  configWritten: boolean;
  configPath: string | null;
  createdAt: string;
}

export interface SubagentInstanceRecord {
  id: string;
  projectId: string;
  subagentName: string;
  agentType: AgentType;
  targetAgentId: string;
  status: "running" | "completed" | "error";
  createdAt: Date;
  finishedAt: Date | null;
}

export type DomainEvent =
  | { type: "agent_registered"; payload: AgentRecord }
  | { type: "agent_updated"; payload: AgentRecord }
  | { type: "message_sent"; payload: MessageRecord }
  | { type: "task_started"; payload: TaskRecord }
  | { type: "task_finished"; payload: TaskRecord }
  | { type: "file_claimed"; payload: FileClaimRecord }
  | { type: "file_released"; payload: FileClaimRecord }
  | { type: "decision_recorded"; payload: DecisionRecord }
  | { type: "memory_updated"; payload: any }
  | { type: "schedule_created"; payload: ScheduleRecord }
  | { type: "schedule_completed"; payload: ScheduleRecord }
  | { type: "schedule_cancelled"; payload: ScheduleRecord }
  | { type: "session_saved"; payload: SessionSnapshotRecord }
  | { type: "goal_started"; payload: GoalRecord }
  | { type: "goal_updated"; payload: GoalRecord }
  | { type: "goal_completed"; payload: GoalRecord }
  | { type: "goal_paused"; payload: GoalRecord }
  | { type: "goal_claimed"; payload: GoalRecord }
  | { type: "subagent_created"; payload: SubagentDef }
  | { type: "subagent_updated"; payload: SubagentDef }
  | { type: "subagent_deleted"; payload: { name: string } }
  | { type: "subagent_launched"; payload: { name: string; configPath: string | null; success: boolean } }
  | { type: "subagent_instance_created"; payload: SubagentInstanceRecord }
  | { type: "subagent_instance_completed"; payload: SubagentInstanceRecord }
  | { type: "subagent_instance_error"; payload: SubagentInstanceRecord }
  | { type: "project_init_step"; payload: ProjectInitStep }
  | { type: "project_init_done"; payload: { projectId: string; name: string; rootPath: string } }
  | { type: "project_init_error"; payload: { error: string } };

export interface ProjectInitStep {
  step: string;
  status: "running" | "done" | "error";
  message: string;
}

export interface GoalRecord {
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

export interface StartGoalInput {
  projectId?: string;
  agentId: string;
  parentGoalId?: string | null;
  title: string;
  description: string;
  stopCondition?: string | null;
  maxIterations?: number | null;
}

export interface UpdateGoalInput {
  goalId: string;
  projectId?: string;
  status?: string;
  progress?: string | null;
  summary?: string | null;
}
