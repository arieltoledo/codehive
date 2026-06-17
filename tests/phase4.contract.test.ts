import { WebSocket } from "ws";
import { setTimeout as delay } from "node:timers/promises";

import { buildApp } from "../server/app.js";
import { createAgentToolHandlers } from "../mcp/tools/agent.js";
import { createTraceabilityToolHandlers } from "../mcp/tools/traceability.js";
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

describe("Phase 4 MCP contracts (Traceability)", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context?.cleanup();
  });

  it("claims and releases files with correct persistence and snake_case responses", async () => {
    const testContext = requireTestContext(context);
    const agentTools = createAgentToolHandlers(testContext.services);
    const traceabilityTools = createTraceabilityToolHandlers(testContext.services);

    await agentTools.register({
      agent_id: "trace_agent",
      name: "Trace Agent",
      provider: "codex",
      role: "backend"
    });

    const claimed = await traceabilityTools.claimFile({
      agent_id: "trace_agent",
      file_path: "src/index.ts",
      reason: "Refactoring"
    });

    expect(claimed.claim).toMatchObject({
      agent_id: "trace_agent",
      file_path: "src/index.ts",
      status: "active",
      reason: "Refactoring"
    });

    const dbClaim = await testContext.prisma.fileClaim.findFirst({
      where: { agentId: "trace_agent", filePath: "src/index.ts", status: "active" }
    });
    expect(dbClaim).toBeDefined();

    const released = await traceabilityTools.releaseFile({
      agent_id: "trace_agent",
      file_path: "src/index.ts"
    });

    expect(released.claim.status).toBe("released");
    expect(released.claim.released_at).not.toBeNull();

    const dbReleased = await testContext.prisma.fileClaim.findUnique({
      where: { id: dbClaim?.id }
    });
    expect(dbReleased?.status).toBe("released");
    expectSnakeCaseKeys(released);
  });

  it("records decisions correctly", async () => {
    const testContext = requireTestContext(context);
    const agentTools = createAgentToolHandlers(testContext.services);
    const traceabilityTools = createTraceabilityToolHandlers(testContext.services);

    await agentTools.register({
      agent_id: "decision_agent",
      name: "Decision Agent",
      provider: "codex",
      role: "architect"
    });

    const recorded = await traceabilityTools.recordDecision({
      agent_id: "decision_agent",
      decision: "Use PostgreSQL",
      reason: "Scalability requirements",
      task_id: "task_456"
    });

    expect(recorded.decision).toMatchObject({
      agent_id: "decision_agent",
      decision: "Use PostgreSQL",
      reason: "Scalability requirements",
      task_id: "task_456"
    });

    const dbDecision = await testContext.prisma.decision.findFirst({
      where: { agentId: "decision_agent", decision: "Use PostgreSQL" }
    });
    expect(dbDecision).toBeDefined();
    expectSnakeCaseKeys(recorded);
  });

  it("throws errors when agent does not exist or claim not found", async () => {
    const testContext = requireTestContext(context);
    const traceabilityTools = createTraceabilityToolHandlers(testContext.services);

    await expect(
      traceabilityTools.claimFile({
        agent_id: "missing_agent",
        file_path: "test.txt",
        reason: "Testing error"
      })
    ).rejects.toMatchObject({
      code: "AGENT_NOT_FOUND",
      statusCode: 404
    });

    await expect(
      traceabilityTools.releaseFile({
        agent_id: "missing_agent",
        file_path: "test.txt"
      })
    ).rejects.toMatchObject({
      code: "CLAIM_NOT_FOUND",
      statusCode: 404
    });
  });
});

describe("Phase 4 WebSocket contracts (Traceability)", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context?.cleanup();
  });

  it("broadcasts traceability events over WebSocket", async () => {
    const testContext = requireTestContext(context);
    const app = await buildApp({
      services: testContext.services,
      logger: false
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
        agentId: "ws_trace_agent",
        name: "WS Trace Agent",
        provider: "codex",
        role: "qa"
      });

      await testContext.services.traceability.claimFile({
        agentId: "ws_trace_agent",
        filePath: "README.md",
        reason: "Updating docs"
      });

      await testContext.services.traceability.releaseFile({
        agentId: "ws_trace_agent",
        filePath: "README.md"
      });

      await testContext.services.traceability.recordDecision({
        agentId: "ws_trace_agent",
        decision: "Approve PR",
        reason: "Tests passed"
      });

      // Wait for events to be processed
      await delay(200);

      expect(receivedEvents).toContainEqual(expect.objectContaining({ type: "file_claimed" }));
      expect(receivedEvents).toContainEqual(expect.objectContaining({ type: "file_released" }));
      expect(receivedEvents).toContainEqual(expect.objectContaining({ type: "decision_recorded" }));

      ws.close();
    } finally {
      await app.close();
    }
  });
});
