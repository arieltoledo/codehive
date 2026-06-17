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

export type DomainEvent =
  | { type: "agent_registered"; payload: AgentRecord }
  | { type: "agent_updated"; payload: AgentRecord }
  | { type: "message_sent"; payload: MessageRecord }
  | { type: "task_started"; payload: TaskRecord }
  | { type: "task_finished"; payload: TaskRecord }
  | { type: "file_claimed"; payload: FileClaimRecord }
  | { type: "file_released"; payload: FileClaimRecord }
  | { type: "decision_recorded"; payload: DecisionRecord }
  | { type: "memory_updated"; payload: any };
