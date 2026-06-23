import { z } from "zod";
import type { DomainServices } from "../../server/domain/services.js";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

async function apiPost(path: string, body: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json() as any;
    throw new Error(error.error?.message ?? `POST ${path} failed`);
  }
  return response.json();
}

async function apiGet(path: string) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    const error = await response.json() as any;
    throw new Error(error.error?.message ?? `GET ${path} failed`);
  }
  return response.json();
}

async function apiDelete(path: string) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const error = await response.json() as any;
    throw new Error(error.error?.message ?? `DELETE ${path} failed`);
  }
  return response.json();
}

async function apiPatch(path: string, body: unknown) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json() as any;
    throw new Error(error.error?.message ?? `PATCH ${path} failed`);
  }
  return response.json();
}

export const subagentCreateSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
  agentType: z.string().min(1),
  targetAgentId: z.string().min(1),
  instructions: z.string().min(1),
  fields: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const subagentUpdateSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
  targetAgentId: z.string().optional(),
  instructions: z.string().optional(),
  fields: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const subagentDeleteSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
});

export const subagentLaunchSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
});

export const subagentGetSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
});

export const subagentListInstancesSchema = z.object({
  projectId: z.string().optional(),
  status: z.string().optional(),
});

export const subagentCompleteSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
});

export const subagentFailSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1),
});

export const subagentSearchTemplatesSchema = z.object({
  projectId: z.string().optional(),
  q: z.string().min(1),
});

export function createSubagentToolHandlers(_services: DomainServices) {
  return {
    create: async (input: unknown) => {
      const parsed = subagentCreateSchema.parse(input);
      return apiPost("/api/subagents", parsed);
    },

    list: async () => {
      return apiGet("/api/subagents");
    },

    get: async (input: unknown) => {
      const parsed = subagentGetSchema.parse(input);
      return apiGet(`/api/subagents/${encodeURIComponent(parsed.name)}`);
    },

    update: async (input: unknown) => {
      const parsed = subagentUpdateSchema.parse(input);
      const { name, ...body } = parsed;
      return apiPatch(`/api/subagents/${encodeURIComponent(name)}`, body);
    },

    delete: async (input: unknown) => {
      const parsed = subagentDeleteSchema.parse(input);
      return apiDelete(`/api/subagents/${encodeURIComponent(parsed.name)}`);
    },

    launch: async (input: unknown) => {
      const parsed = subagentLaunchSchema.parse(input);
      return apiPost(`/api/subagents/${encodeURIComponent(parsed.name)}/launch`, {});
    },

    listInstances: async (input: unknown) => {
      const parsed = subagentListInstancesSchema.parse(input);
      const qs = parsed.status ? `?status=${encodeURIComponent(parsed.status)}` : "";
      return apiGet(`/api/subagents/instances${qs}`);
    },

    complete: async (input: unknown) => {
      const parsed = subagentCompleteSchema.parse(input);
      return apiPost(`/api/subagents/${encodeURIComponent(parsed.name)}/complete`, {});
    },

    fail: async (input: unknown) => {
      const parsed = subagentFailSchema.parse(input);
      return apiPost(`/api/subagents/${encodeURIComponent(parsed.name)}/fail`, {});
    },

    getSchemas: async () => {
      return apiGet("/api/subagents/schemas");
    },

    searchTemplates: async (input: unknown) => {
      const parsed = subagentSearchTemplatesSchema.parse(input);
      return apiGet(`/api/subagents/templates/search?q=${encodeURIComponent(parsed.q)}`);
    },
  };
}
