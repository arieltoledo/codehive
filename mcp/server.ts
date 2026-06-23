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
import {
  createScheduleToolHandlers,
  scheduleWakeupSchema,
  scheduleListSchema,
  scheduleCancelSchema,
} from "./tools/schedule.js";
import {
  createSessionToolHandlers,
  sessionSaveSchema,
  sessionRestoreSchema,
} from "./tools/session.js";
import {
  createGoalToolHandlers,
  goalStartSchema,
  goalStatusSchema,
  goalListSchema,
  goalCompleteSchema,
  goalClaimSchema,
  goalPauseSchema,
  goalIncrementIterationSchema,
} from "./tools/goal.js";
import {
  createSubagentToolHandlers,
  subagentCreateSchema,
  subagentUpdateSchema,
  subagentDeleteSchema,
  subagentGetSchema,
  subagentLaunchSchema,
  subagentListInstancesSchema,
  subagentCompleteSchema,
  subagentFailSchema,
  subagentSearchTemplatesSchema,
} from "./tools/subagent.js";
import { registerCoordinationResource } from "./resources/coordination.js";

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
  const scheduleTools = createScheduleToolHandlers(services);
  const sessionTools = createSessionToolHandlers(services);
  const goalTools = createGoalToolHandlers(services);
  const subagentTools = createSubagentToolHandlers(services);

  // Detect projectId from current working directory
  const folderName = path.basename(process.cwd());
  const projectId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Auto-provision the project so FK constraints don't fail
  services.projects.ensure(projectId).catch((err: Error) => console.error("Failed to ensure project:", err));
  services.projects.ensure("local").catch((err: Error) => console.error("Failed to ensure local project:", err));

  server.registerTool(
    "agent_register",
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
    "agent_update_status",
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
    "chat_send",
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
    "chat_read",
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
    "task_start",
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
    "task_finish",
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
    "traceability_claim_file",
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
    "traceability_release_file",
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
    "traceability_record_decision",
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
    "memory_publish",
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
    "memory_list",
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
    "memory_read",
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

  server.registerTool(
    "schedule_wakeup",
    {
      title: "Schedule wake-up",
      description: "Schedule an agent wake-up via cron when token limits reset.",
      inputSchema: scheduleWakeupSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await scheduleTools.wakeup({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "schedule_list",
    {
      title: "List schedules",
      description: "List scheduled wake-ups for an agent.",
      inputSchema: scheduleListSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await scheduleTools.list({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "schedule_cancel",
    {
      title: "Cancel schedule",
      description: "Cancel a previously scheduled wake-up.",
      inputSchema: scheduleCancelSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await scheduleTools.cancel({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "session_save",
    {
      title: "Save session snapshot",
      description: "Save a snapshot of current agent session before going offline.",
      inputSchema: sessionSaveSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await sessionTools.save({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "session_restore",
    {
      title: "Restore session snapshot",
      description: "Restore the last session snapshot for an agent.",
      inputSchema: sessionRestoreSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await sessionTools.restore({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "goal_start",
    {
      title: "Start a goal",
      description: "Start a new verifiable goal for an agent.",
      inputSchema: goalStartSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await goalTools.start({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "goal_status",
    {
      title: "Get goal status",
      description: "Get the current status of a goal.",
      inputSchema: goalStatusSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await goalTools.status(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "goal_list",
    {
      title: "List goals",
      description: "List goals, optionally filtered by agent or status.",
      inputSchema: goalListSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await goalTools.list({ ...input, projectId }));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "goal_complete",
    {
      title: "Complete a goal",
      description: "Mark a goal as completed with optional summary.",
      inputSchema: goalCompleteSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await goalTools.complete(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "goal_claim",
    {
      title: "Claim a goal",
      description: "Re-assign a paused goal to a different agent.",
      inputSchema: goalClaimSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await goalTools.claim(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );
  
  server.registerTool(
    "goal_pause",
    {
      title: "Pause a goal",
      description: "Pause a goal with current progress summary.",
      inputSchema: goalPauseSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await goalTools.pause(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "goal_increment_iteration",
    {
      title: "Increment goal iteration",
      description: "Increment the iteration counter for a goal. Auto-pauses if max_iterations reached.",
      inputSchema: goalIncrementIterationSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await goalTools.incrementIteration(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  // Subagent tools
  server.registerTool(
    "subagent_create",
    {
      title: "Create subagent definition",
      description: "Create a new subagent definition stored on disk.",
      inputSchema: subagentCreateSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.create(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_list",
    {
      title: "List subagent definitions",
      description: "List all subagent definitions from disk.",
      inputSchema: z.object({}).shape
    },
    async () => {
      try {
        return toToolContent(await subagentTools.list());
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_get",
    {
      title: "Get subagent definition",
      description: "Get a single subagent definition by name.",
      inputSchema: subagentGetSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.get(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_update",
    {
      title: "Update subagent definition",
      description: "Update an existing subagent definition.",
      inputSchema: subagentUpdateSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.update(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_delete",
    {
      title: "Delete subagent definition",
      description: "Delete a subagent definition by name.",
      inputSchema: subagentDeleteSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.delete(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_launch",
    {
      title: "Launch subagent instance",
      description: "Create a running instance for a subagent definition.",
      inputSchema: subagentLaunchSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.launch(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_complete",
    {
      title: "Complete subagent instance",
      description: "Mark a running subagent instance as completed.",
      inputSchema: subagentCompleteSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.complete(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_fail",
    {
      title: "Fail subagent instance",
      description: "Mark a running subagent instance as failed.",
      inputSchema: subagentFailSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.fail(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_list_instances",
    {
      title: "List subagent instances",
      description: "List subagent instances, optionally filtered by status.",
      inputSchema: subagentListInstancesSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.listInstances(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_get_schemas",
    {
      title: "Get subagent schemas",
      description: "List all available subagent type schemas (Codex, Claude-Code, OpenCode, Antigravity).",
      inputSchema: z.object({}).shape
    },
    async () => {
      try {
        return toToolContent(await subagentTools.getSchemas());
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "subagent_search_templates",
    {
      title: "Search subagent templates",
      description: "Search community subagent templates from claude-plugins.dev and other registries.",
      inputSchema: subagentSearchTemplatesSchema.shape
    },
    async (input) => {
      try {
        return toToolContent(await subagentTools.searchTemplates(input));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  registerCoordinationResource(server);

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
