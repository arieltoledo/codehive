import { z } from "zod";
import type { DomainServices } from "../../server/domain/services.js";

export const memoryPublishSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  description: z.string().optional()
});

export const memoryReadSchema = z.object({
  filename: z.string().min(1)
});

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export function createMemoryToolHandlers(services: DomainServices) {
  return {
    publish: async (input: any) => {
      const parsed = memoryPublishSchema.parse(input);
      const response = await fetch(`${API_URL}/api/memory/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: input.projectId,
          filename: parsed.filename,
          content: parsed.content
        })
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to publish memory via API");
      }

      return await response.json();
    },
    list: async (input: any) => {
      const url = new URL(`${API_URL}/api/projects/${input.projectId}/memory`);
      const response = await fetch(url.toString());
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to list memory via API");
      }

      return await response.json();
    },
    read: async (input: any) => {
      const parsed = memoryReadSchema.parse(input);
      const url = new URL(`${API_URL}/api/projects/${input.projectId}/memory/${parsed.filename}`);
      const response = await fetch(url.toString());
      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to read memory via API");
      }

      return await response.json();
    }
  };
}
