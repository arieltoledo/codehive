import { z } from "zod";

import type { DomainServices } from "../../server/domain/services.js";

export const scheduleWakeupSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().min(1),
  session_id: z.string().optional(),
  command: z.string().min(1),
  wakeup_at: z.string().min(1),
  message: z.string().optional(),
});

export const scheduleListSchema = z.object({
  projectId: z.string().min(1).optional(),
  agent_id: z.string().optional(),
  status: z.string().optional(),
});

export const scheduleCancelSchema = z.object({
  projectId: z.string().min(1).optional(),
  schedule_id: z.string().min(1),
});

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export function createScheduleToolHandlers(_services: DomainServices) {
  return {
    wakeup: async (input: unknown) => {
      const parsed = scheduleWakeupSchema.parse(input);
      const response = await fetch(`${API_URL}/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to create schedule");
      }
      return { schedule: await response.json() };
    },

    list: async (input: unknown) => {
      const parsed = scheduleListSchema.parse(input);
      const params = new URLSearchParams();
      if (parsed.projectId) params.set("project_id", parsed.projectId);
      if (parsed.agent_id) params.set("agent_id", parsed.agent_id);
      if (parsed.status) params.set("status", parsed.status);
      const qs = params.toString();
      const response = await fetch(`${API_URL}/api/schedules${qs ? `?${qs}` : ""}`);
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to list schedules");
      }
      return { schedules: await response.json() };
    },

    cancel: async (input: unknown) => {
      const parsed = scheduleCancelSchema.parse(input);
      const response = await fetch(`${API_URL}/api/schedules/${parsed.schedule_id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to cancel schedule");
      }
      return { schedule: await response.json() };
    },
  };
}
