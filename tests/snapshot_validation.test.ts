import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../server/app.js";
import { createTestContext, type TestContext } from "./helpers/testDatabase.js";

describe("Dashboard Snapshot Integration", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context?.cleanup();
  });

  it("returns a complete snapshot with agents, messages, tasks, file claims, and decisions", async () => {
    if (!context) throw new Error("Context not initialized");
    const { services, prisma } = context;
    const app = await buildApp({ services });

    try {
      // 1. Setup Data
      await services.agents.registerAgent({
        agentId: "agent-1",
        name: "Agent One",
        provider: "provider-1",
        role: "worker"
      });

      await services.chat.sendMessage({
        roomId: "project_main",
        senderId: "agent-1",
        message: "Hello world",
        messageType: "status"
      });

      await prisma.task.create({
        data: {
          id: "task-1",
          title: "Test Task",
          description: "A task for testing",
          status: "in_progress",
          assignedAgentId: "agent-1"
        }
      });

      await prisma.fileClaim.create({
        data: {
          agentId: "agent-1",
          taskId: "task-1",
          filePath: "src/main.ts",
          status: "claimed",
          reason: "Testing claims"
        }
      });

      await prisma.decision.create({
        data: {
          agentId: "agent-1",
          taskId: "task-1",
          decision: "Approve",
          reason: "Matches requirements"
        }
      });

      // 2. Call Endpoint
      const response = await app.inject({
        method: "GET",
        url: "/api/dashboard/snapshot"
      });

      // 3. Assertions
      expect(response.statusCode).toBe(200);
      const data = response.json();

      expect(data).toHaveProperty("agents");
      expect(data.agents).toHaveLength(1);
      expect(data.agents[0]).toMatchObject({
        agent_id: "agent-1",
        name: "Agent One"
      });

      expect(data).toHaveProperty("messages");
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0]).toMatchObject({
        sender_id: "agent-1",
        message: "Hello world"
      });

      expect(data).toHaveProperty("active_tasks");
      expect(data.active_tasks).toHaveLength(1);
      expect(data.active_tasks[0]).toMatchObject({
        task_id: "task-1",
        title: "Test Task"
      });

      expect(data).toHaveProperty("file_claims");
      expect(data.file_claims).toHaveLength(1);
      expect(data.file_claims[0]).toMatchObject({
        agent_id: "agent-1",
        file_path: "src/main.ts"
      });

      expect(data).toHaveProperty("decisions");
      expect(data.decisions).toHaveLength(1);
      expect(data.decisions[0]).toMatchObject({
        agent_id: "agent-1",
        decision: "Approve"
      });

      // Verify snake_case keys
      const checkSnakeCase = (obj: any) => {
        for (const key in obj) {
          expect(key).not.toMatch(/[A-Z]/);
          if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
            checkSnakeCase(obj[key]);
          } else if (Array.isArray(obj[key])) {
            obj[key].forEach((item: any) => {
               if (typeof item === "object" && item !== null) checkSnakeCase(item);
            });
          }
        }
      };
      checkSnakeCase(data);

    } finally {
      await app.close();
    }
  });
});
