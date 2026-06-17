import { WebSocket } from "ws";
import { setTimeout as delay } from "node:timers/promises";

import { buildApp } from "../server/app.js";
import { createAgentToolHandlers } from "../mcp/tools/agent.js";
import { createTaskToolHandlers } from "../mcp/tools/task.js";
import { createTestContext, type TestContext } from "./helpers/testDatabase.js";

function expectSnakeCaseKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectSnakeCaseKeys);
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    expect(key).not.toMatch(/[A-Z]/);
    expectSnakeCaseKeys(nested);
  }
}

function requireTestContext(context: TestContext | undefined): TestContext {
  if (!context) {
    throw new Error("Test context was not initialized.");
  }

  return context;
}

describe("Phase 2 MCP contracts", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context?.cleanup();
  });

  it("updates agent status and maps 'paused' to 'blocked'", async () => {
    const testContext = requireTestContext(context);
    const agentTools = createAgentToolHandlers(testContext.services);

    await agentTools.register({
      agent_id: "status_agent",
      name: "Status Agent",
      provider: "codex",
      role: "backend"
    });

    const working = await agentTools.updateStatus({
      agent_id: "status_agent",
      status: "working"
    });
    expect(working.agent.status).toBe("working");

    const paused = await agentTools.updateStatus({
      agent_id: "status_agent",
      status: "paused"
    });
    expect(paused.agent.status).toBe("blocked");

    const dbAgent = await testContext.prisma.agent.findUnique({ where: { id: "status_agent" } });
    expect(dbAgent?.status).toBe("blocked");
    expectSnakeCaseKeys(paused);
  });

  it("starts and finishes tasks, updating agent status correctly", async () => {
    const testContext = requireTestContext(context);
    const agentTools = createAgentToolHandlers(testContext.services);
    const taskTools = createTaskToolHandlers(testContext.services);

    await agentTools.register({
      agent_id: "task_agent",
      name: "Task Agent",
      provider: "codex",
      role: "backend"
    });

    const started = await taskTools.start({
      task_id: "task_1",
      agent_id: "task_agent",
      title: "Fix bug",
      description: "A bug in the system"
    });

    expect(started.task).toMatchObject({
      task_id: "task_1",
      status: "running",
      assigned_agent_id: "task_agent"
    });

    const agentWorking = await testContext.prisma.agent.findUnique({ where: { id: "task_agent" } });
    expect(agentWorking?.status).toBe("working");
    expect(agentWorking?.currentTaskId).toBe("task_1");

    const finished = await taskTools.finish({
      task_id: "task_1",
      status: "completed"
    });

    expect(finished.task.status).toBe("done");
    const agentIdle = await testContext.prisma.agent.findUnique({ where: { id: "task_agent" } });
    expect(agentIdle?.status).toBe("idle");
    expect(agentIdle?.currentTaskId).toBeNull();
    expectSnakeCaseKeys(finished);
  });
});

describe("Phase 2 WebSocket contracts", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context?.cleanup();
  });

  it("broadcasts domain events to connected WebSocket clients", async () => {
    const testContext = requireTestContext(context);
    const app = await buildApp({
      services: testContext.services,
      logger: true
    });

    try {
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address();
      if (!address || typeof address === "string") throw new Error("Server address not found");

      const wsUrl = `ws://127.0.0.1:${address.port}/ws`;
      const ws = new WebSocket(wsUrl);

      const receivedEvents: any[] = [];
      ws.on("message", (data) => {
        receivedEvents.push(JSON.parse(data.toString()));
      });

      await new Promise((resolve) => ws.on("open", resolve));

      // Trigger events
      await testContext.services.agents.registerAgent({
        agentId: "ws_agent",
        name: "WS Agent",
        provider: "codex",
        role: "qa"
      });

      await testContext.services.chat.sendMessage({
        roomId: "ws_room",
        senderId: "ws_agent",
        message: "Hello WS",
        messageType: "status"
      });

      // Wait for events to be processed
      await delay(200);

      if (receivedEvents.length === 0) {
        console.log("No events received over WebSocket");
      }

      expect(receivedEvents).toContainEqual(expect.objectContaining({ type: "agent_registered" }));
      expect(receivedEvents).toContainEqual(expect.objectContaining({ type: "message_sent" }));

      // Verify snake_case keys in WebSocket events
      receivedEvents.forEach((event) => {
        expectSnakeCaseKeys(event);
      });

      ws.close();
    } finally {
      await app.close();
    }
  });
});
