import { z } from "zod";

import { DEFAULT_MESSAGE_LIMIT, DEFAULT_ROOM_ID, MAX_MESSAGE_LIMIT } from "../../server/config/defaults.js";
import type { DomainServices } from "../../server/domain/services.js";
import { toMessageDto } from "../../server/http/presenters.js";

export const chatSendSchema = z.object({
  room_id: z.string().min(1),
  sender_id: z.string().min(1),
  message: z.string().min(1),
  message_type: z.string().min(1).default("status"),
  task_id: z.string().min(1).nullable().optional()
});

export const chatReadSchema = z.object({
  room_id: z.string().min(1).default(DEFAULT_ROOM_ID),
  limit: z.number().int().min(1).max(MAX_MESSAGE_LIMIT).default(DEFAULT_MESSAGE_LIMIT)
});

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export function createChatToolHandlers(services: DomainServices) {
  return {
    send: async (input: unknown) => {
      const parsed = chatSendSchema.parse(input);
      
      const response = await fetch(`${API_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message ?? "Failed to send message via API");
      }

      const message = await response.json();
      return { message };
    },
    read: async (input: unknown) => {
      const parsed = chatReadSchema.parse(input);
      const url = new URL(`${API_URL}/api/messages`);
      url.searchParams.append("room_id", parsed.room_id);
      url.searchParams.append("limit", parsed.limit.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message ?? "Failed to read messages via API");
      }

      const { messages } = await response.json();
      return { messages };
    }
  };
}
