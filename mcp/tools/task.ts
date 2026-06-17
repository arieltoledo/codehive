import { z } from "zod";

import type { DomainServices } from "../../server/domain/services.js";
import { toTaskDto } from "../../server/http/presenters.js";

export const taskStartSchema = z.object({
  task_id: z.string().min(1),
  agent_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default("")
});

export const taskFinishSchema = z.object({
  task_id: z.string().min(1),
  status: z.enum(["completed", "failed"])
});

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export function createTaskToolHandlers(services: DomainServices) {
  return {
    start: async (input: unknown) => {
      const parsed = taskStartSchema.parse(input);
      const response = await fetch(`${API_URL}/api/tasks/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to start task via API");
      }

      const task = await response.json();
      return { task };
    },
    finish: async (input: unknown) => {
      const parsed = taskFinishSchema.parse(input);
      const response = await fetch(`${API_URL}/api/tasks/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: parsed.task_id,
          status: parsed.status === "completed" ? "done" : "error"
        })
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to finish task via API");
      }

      const task = await response.json();
      return { task };
    }
  };
}
