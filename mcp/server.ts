import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { z } from "zod";

import { createDomainServices, type DomainServices } from "../server/domain/services.js";
import { DomainError } from "../server/domain/errors.js";
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
  const folderName = path.basename(process.cwd());
  const projectId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-');

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
        return toToolContent(await agentTools.updateStatus({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "chat.send",
    {
      title: "Send chat message",
      description: "Send a message to a coordination room.",
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
      description: "Read recent messages from a coordination room.",
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
      description: "Mark the beginning of a discrete work unit.",
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
      description: "Mark a task as completed or failed.",
      inputSchema: taskFinishSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await taskTools.finish({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "traceability.claim_file",
    {
      title: "Claim file",
      description: "Mark a file as being modified by an agent for a specific task.",
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
    "traceability.release_file",
    {
      title: "Release file",
      description: "Mark a file as released after modification.",
      inputSchema: fileReleaseSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await traceabilityTools.releaseFile({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "traceability.record_decision",
    {
      title: "Record decision",
      description: "Log an important architectural or logic decision.",
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
      title: "Publish to shared memory",
      description: "Save information to the shared project knowledge base.",
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
      description: "List files in the shared project knowledge base.",
      inputSchema: z.object({}).shape
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
      description: "Read a file from the shared project knowledge base.",
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

export async function runServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CodeHive MCP Server running on stdio");
}

// Start the server
runServer().catch(console.error);
