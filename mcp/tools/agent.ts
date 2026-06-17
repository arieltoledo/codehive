import { z } from "zod";

import type { DomainServices } from "../../server/domain/services.js";
import { toAgentDto } from "../../server/http/presenters.js";
import type { AgentStatus } from "../../server/domain/types.js";

export const agentRegisterSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  role: z.string().min(1),
  parent_agent_id: z.string().min(1).nullable().optional()
});

export const agentUpdateStatusSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1),
  status: z.enum(["idle", "working", "error", "paused"])
});

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export function createAgentToolHandlers(services: DomainServices) {
  return {
    register: async (input: unknown) => {
      const parsed = agentRegisterSchema.parse(input);
      const response = await fetch(`${API_URL}/api/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to register agent via API");
      }

      const agent = await response.json();
      return { agent };
    },
    updateStatus: async (input: unknown) => {
      const parsed = agentUpdateStatusSchema.parse(input);
      const response = await fetch(`${API_URL}/api/agents/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to update agent status via API");
      }

      const agent = await response.json();
      return { agent };
    }
  };
}
