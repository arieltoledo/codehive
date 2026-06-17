import type { PrismaClient } from "@prisma/client";

import { createPrismaClient } from "../db/prisma.js";
import { AgentService } from "./agents.js";
import { ChatService } from "./chat.js";
import { DashboardService } from "./dashboard.js";
import { EventBus } from "./events.js";
import { MemoryService } from "./memory.js";
import { ProjectService } from "./projects.js";
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

  return {
    prisma,
    events,
    agents,
    chat,
    tasks,
    dashboard,
    traceability,
    memory,
    projects
  };
}
