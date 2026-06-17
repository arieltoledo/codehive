import { setTimeout as delay } from "node:timers/promises";

import { buildApp } from "../server/app.js";
import { createAgentToolHandlers } from "../mcp/tools/agent.js";
import { createChatToolHandlers } from "../mcp/tools/chat.js";
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

describe("Phase 1 MCP contracts", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context?.cleanup();
  });

  it("registers agents idempotently with a snake_case payload and response", async () => {
    const testContext = requireTestContext(context);
    const agentTools = createAgentToolHandlers(testContext.services);
    const payload = {
      agent_id: "qa_agent",
      name: "QA Agent",
      provider: "codex",
      role: "qa",
      parent_agent_id: null
    };

    const first = await agentTools.register(payload);
    const second = await agentTools.register({
      ...payload,
      name: "QA Agent Updated"
    });

    expect(second.agent).toMatchObject({
      agent_id: "qa_agent",
      name: "QA Agent Updated",
      provider: "codex",
      role: "qa",
      parent_agent_id: null,
      status: "idle",
      current_task_id: null
    });
    expect(first.agent.created_at).toBe(second.agent.created_at);
    expect(await testContext.prisma.agent.count({ where: { id: "qa_agent" } })).toBe(1);
    expectSnakeCaseKeys(second);
  });

  it("persists chat messages, rejects unknown senders, filters rooms, limits, and returns chronological order", async () => {
    const testContext = requireTestContext(context);
    const agentTools = createAgentToolHandlers(testContext.services);
    const chatTools = createChatToolHandlers(testContext.services);

    await agentTools.register({
      agent_id: "sender_agent",
      name: "Sender Agent",
      provider: "codex",
      role: "backend"
    });

    await expect(
      chatTools.send({
        room_id: "phase_1",
        sender_id: "missing_agent",
        message: "Should fail",
        message_type: "status"
      })
    ).rejects.toMatchObject({
      code: "AGENT_NOT_FOUND",
      statusCode: 404
    });

    await chatTools.send({
      room_id: "phase_1",
      sender_id: "sender_agent",
      message: "First",
      message_type: "status"
    });
    await delay(5);
    await chatTools.send({
      room_id: "phase_1",
      sender_id: "sender_agent",
      message: "Second",
      message_type: "decision"
    });
    await delay(5);
    const third = await chatTools.send({
      room_id: "phase_1",
      sender_id: "sender_agent",
      message: "Third",
      message_type: "result"
    });
    await chatTools.send({
      room_id: "other_room",
      sender_id: "sender_agent",
      message: "Other room",
      message_type: "status"
    });

    const limited = await chatTools.read({
      room_id: "phase_1",
      limit: 2
    });
    const otherRoom = await chatTools.read({
      room_id: "other_room",
      limit: 10
    });

    expect(limited.messages.map((message) => message.message)).toEqual(["Second", "Third"]);
    expect(limited.messages.every((message) => message.room_id === "phase_1")).toBe(true);
    expect(otherRoom.messages.map((message) => message.message)).toEqual(["Other room"]);
    expect(await testContext.prisma.message.count({ where: { roomId: "phase_1" } })).toBe(3);
    expect(third.message).toMatchObject({
      room_id: "phase_1",
      sender_id: "sender_agent",
      sender_type: "agent",
      message_type: "result",
      message: "Third",
      task_id: null
    });
    expectSnakeCaseKeys(limited);
  });
});

describe("Phase 1 HTTP contracts", () => {
  let context: TestContext | undefined;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context?.cleanup();
  });

  it("exposes health, agents, messages with room_id and roomId, and dashboard snapshot with snake_case responses", async () => {
    const testContext = requireTestContext(context);
    const app = await buildApp({
      services: testContext.services
    });

    try {
      await testContext.services.agents.registerAgent({
        agentId: "http_agent",
        name: "HTTP Agent",
        provider: "codex",
        role: "qa",
        parentAgentId: null
      });
      await testContext.services.chat.sendMessage({
        roomId: "project_main",
        senderId: "http_agent",
        message: "Snapshot message",
        messageType: "status"
      });
      await testContext.services.chat.sendMessage({
        roomId: "http_room",
        senderId: "http_agent",
        message: "HTTP first",
        messageType: "status"
      });
      await delay(5);
      await testContext.services.chat.sendMessage({
        roomId: "http_room",
        senderId: "http_agent",
        message: "HTTP second",
        messageType: "result"
      });
      await testContext.services.chat.sendMessage({
        roomId: "alias_room",
        senderId: "http_agent",
        message: "Alias room",
        messageType: "status"
      });

      const health = await app.inject({ method: "GET", url: "/health" });
      const agents = await app.inject({ method: "GET", url: "/agents" });
      const messagesBySnakeCase = await app.inject({
        method: "GET",
        url: "/messages?room_id=http_room&limit=1"
      });
      const messagesByAlias = await app.inject({
        method: "GET",
        url: "/messages?roomId=alias_room&limit=5"
      });
      const snapshot = await app.inject({
        method: "GET",
        url: "/api/dashboard/snapshot"
      });

      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({ status: "ok" });

      expect(agents.statusCode).toBe(200);
      expect(agents.json()).toMatchObject({
        agents: [
          {
            agent_id: "http_agent",
            parent_agent_id: null,
            current_task_id: null
          }
        ]
      });

      expect(messagesBySnakeCase.statusCode).toBe(200);
      expect(messagesBySnakeCase.json().messages.map((message: { message: string }) => message.message)).toEqual([
        "HTTP second"
      ]);

      expect(messagesByAlias.statusCode).toBe(200);
      expect(messagesByAlias.json().messages).toMatchObject([
        {
          room_id: "alias_room",
          message: "Alias room",
          sender_id: "http_agent"
        }
      ]);

      expect(snapshot.statusCode).toBe(200);
      expect(snapshot.json()).toMatchObject({
        agents: expect.arrayContaining([
          expect.objectContaining({
            agent_id: "http_agent"
          })
        ]),
        messages: expect.arrayContaining([
          expect.objectContaining({
            room_id: "project_main",
            message: "Snapshot message"
          })
        ]),
        active_tasks: [],
        file_claims: [],
        decisions: []
      });
      expectSnakeCaseKeys(agents.json());
      expectSnakeCaseKeys(messagesBySnakeCase.json());
      expectSnakeCaseKeys(messagesByAlias.json());
      expectSnakeCaseKeys(snapshot.json());
    } finally {
      await app.close();
    }
  });

  it("allows sending messages via POST /api/messages with room_id/sender_id or roomId/senderId and returns MessageDto", async () => {
    const testContext = requireTestContext(context);
    const app = await buildApp({
      services: testContext.services
    });

    try {
      await testContext.services.agents.registerAgent({
        agentId: "poster_agent",
        name: "Poster Agent",
        provider: "codex",
        role: "qa"
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          room_id: "post_room",
          sender_id: "poster_agent",
          message: "POST message",
          message_type: "status"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        room_id: "post_room",
        sender_id: "poster_agent",
        message: "POST message",
        message_type: "status"
      });
      expect(response.json().message_id).toBeDefined();
      expectSnakeCaseKeys(response.json());

      const responseAlias = await app.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          roomId: "alias_post_room",
          senderId: "poster_agent",
          message: "Alias POST message",
          messageType: "result"
        }
      });

      expect(responseAlias.statusCode).toBe(200);
      expect(responseAlias.json()).toMatchObject({
        room_id: "alias_post_room",
        sender_id: "poster_agent",
        message: "Alias POST message",
        message_type: "result"
      });
    } finally {
      await app.close();
    }
  });
});
