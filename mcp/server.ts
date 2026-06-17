import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { DomainError } from "../server/domain/errors.js";
import { createDomainServices, type DomainServices } from "../server/domain/services.js";
import { agentRegisterSchema, agentUpdateStatusSchema, createAgentToolHandlers } from "./tools/agent.js";
import { chatReadSchema, chatSendSchema, createChatToolHandlers } from "./tools/chat.js";
import {
  createMemoryToolHandlers,
  memoryPublishSchema,
  memoryReadSchema
} from "./tools/memory.js";
import { createTaskToolHandlers, taskFinishSchema, taskStartSchema } from "./tools/task.js";
import {
  createTraceabilityToolHandlers,
  decisionRecordSchema,
  fileClaimSchema,
  fileReleaseSchema
} from "./tools/traceability.js";

function toToolContent(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload)
      }
    ]
  };
}

function toToolError(error: unknown) {
  if (error instanceof DomainError) {
    return toToolContent({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

  if (error instanceof Error) {
    return toToolContent({
      error: {
        code: "INVALID_TOOL_INPUT",
        message: error.message
      }
    });
  }

  return toToolContent({
    error: {
      code: "UNKNOWN_ERROR",
      message: "Unexpected MCP tool error."
    }
  });
}

export function createMcpServer(services: DomainServices = createDomainServices()): McpServer {
  const server = new McpServer({
    name: "mcp-agent-control-room",
    version: "0.1.0"
  });

  const agentTools = createAgentToolHandlers(services);
  const chatTools = createChatToolHandlers(services);
  const taskTools = createTaskToolHandlers(services);
  const traceabilityTools = createTraceabilityToolHandlers(services);
  const memoryTools = createMemoryToolHandlers(services);

  // Detect projectId from current working directory
  const projectId = process.cwd();

  server.registerTool(
    "agent.register",
    {
      title: "Register agent",
      description: "Register or refresh an agent in the control room.",
      inputSchema: agentRegisterSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await agentTools.register({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "agent.update_status",
    {
      title: "Update agent status",
      description: "Update the status of a registered agent.",
      inputSchema: agentUpdateStatusSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await agentTools.updateStatus(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "chat.send",
    {
      title: "Send chat message",
      description: "Send a message to a shared agent chat room.",
      inputSchema: chatSendSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await chatTools.send({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "chat.read",
    {
      title: "Read chat messages",
      description: "Read recent messages from a shared agent chat room.",
      inputSchema: chatReadSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await chatTools.read({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "task.start",
    {
      title: "Start task",
      description: "Start a new task assigned to an agent.",
      inputSchema: taskStartSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await taskTools.start({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "task.finish",
    {
      title: "Finish task",
      description: "Mark a task as finished (completed or failed).",
      inputSchema: taskFinishSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await taskTools.finish(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "file.claim",
    {
      title: "Claim file",
      description: "Claim a file for exclusive use by an agent.",
      inputSchema: fileClaimSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await traceabilityTools.claimFile({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "file.release",
    {
      title: "Release file",
      description: "Release a previously claimed file.",
      inputSchema: fileReleaseSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await traceabilityTools.releaseFile(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "decision.record",
    {
      title: "Record decision",
      description: "Record a decision made by an agent.",
      inputSchema: decisionRecordSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await traceabilityTools.recordDecision({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "memory.publish",
    {
      title: "Publish shared memory",
      description: "Publish a markdown file to the project's shared knowledge base.",
      inputSchema: memoryPublishSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await memoryTools.publish({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "memory.list",
    {
      title: "List shared memory",
      description: "List all markdown files in the project's shared knowledge base.",
      inputSchema: {}
    },
    async (input) => {
      try {
        return toToolContent(await memoryTools.list({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "memory.read",
    {
      title: "Read shared memory",
      description: "Read the content of a markdown file from the shared knowledge base.",
      inputSchema: memoryReadSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await memoryTools.read({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMcpServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
