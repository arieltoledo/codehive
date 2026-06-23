import { z } from "zod";

import type { DomainServices } from "../../server/domain/services.js";

export const sessionSaveSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1),
  session_id: z.string().optional(),
  summary: z.string().min(1),
  last_task_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const sessionRestoreSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1),
});

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export function createSessionToolHandlers(_services: DomainServices) {
  return {
    save: async (input: unknown) => {
      const parsed = sessionSaveSchema.parse(input);
      const response = await fetch(`${API_URL}/api/sessions/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to save session snapshot");
      }
      return { snapshot: await response.json() };
    },

    restore: async (input: unknown) => {
      const parsed = sessionRestoreSchema.parse(input);
      const response = await fetch(`${API_URL}/api/sessions/${parsed.agent_id}/last`);
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to restore session snapshot");
      }
      return { snapshot: await response.json() };
    },
  };
}
