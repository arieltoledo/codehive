import type { PrismaClient } from "@prisma/client";

import { createPrismaClient } from "../db/prisma.js";
import { AgentService } from "./agents.js";
import { ChatService } from "./chat.js";
import { DashboardService } from "./dashboard.js";
import { EventBus } from "./events.js";
import { GoalService } from "./goal.js";
import { MemoryService } from "./memory.js";
import { ProjectService } from "./projects.js";
import { ScheduleService } from "./schedule.js";
import { SessionService } from "./session.js";
import { SubagentService } from "./subagents.js";
import { TemplateService } from "./templates.js";
import { TaskService } from "./tasks.js";
import { TraceabilityService } from "./traceability.js";

export interface DomainServices {
  prisma: PrismaClient;
  events: EventBus;
  agents: AgentService;
  chat: ChatService;
  tasks: TaskService;
  dashboard: DashboardService;
  traceability: TraceabilityService;
  memory: MemoryService;
  projects: ProjectService;
  schedules: ScheduleService;
  sessions: SessionService;
  goals: GoalService;
  subagents: SubagentService;
  templates: TemplateService;
}

export function createDomainServices(prisma: PrismaClient = createPrismaClient()): DomainServices {
  const events = new EventBus();
  const agents = new AgentService(prisma, events);
  const chat = new ChatService(prisma, agents, events);
  const tasks = new TaskService(prisma, events);
  const dashboard = new DashboardService(prisma, agents, chat);
  const traceability = new TraceabilityService(prisma, events);
  const memory = new MemoryService(events);
  const projects = new ProjectService(prisma, events);
  const schedules = new ScheduleService(prisma, events);
  const sessions = new SessionService(prisma, events);
  const goals = new GoalService(prisma, events);
  const subagents = new SubagentService(prisma, events);
  const templates = new TemplateService(prisma);

  return {
    prisma,
    events,
    agents,
    chat,
    tasks,
    dashboard,
    traceability,
    memory,
    projects,
    schedules,
    sessions,
    goals,
    subagents,
    templates,
  };
}
