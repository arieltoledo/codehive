import { z } from "zod";

import type { DomainServices } from "../../server/domain/services.js";

export const goalStartSchema = z.object({
  agent_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  stop_condition: z.string().nullable().optional(),
  parent_goal_id: z.string().nullable().optional(),
  max_iterations: z.number().int().positive().nullable().optional(),
});

export const goalStatusSchema = z.object({
  goal_id: z.string().min(1),
});

export const goalListSchema = z.object({
  project_id: z.string().optional(),
  agent_id: z.string().optional(),
  status: z.string().optional(),
  parent_goal_id: z.string().optional(),
});

export const goalCompleteSchema = z.object({
  goal_id: z.string().min(1),
  summary: z.string().nullable().optional(),
});

export const goalClaimSchema = z.object({
  goal_id: z.string().min(1),
  agent_id: z.string().min(1),
});

export const goalPauseSchema = z.object({
  goal_id: z.string().min(1),
  progress: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export const goalIncrementIterationSchema = z.object({
  goal_id: z.string().min(1),
});

export function createGoalToolHandlers(services: DomainServices) {
  return {
    async start(input: z.infer<typeof goalStartSchema> & { projectId?: string }) {
      return services.goals.start({
        projectId: input.projectId,
        agentId: input.agent_id,
        title: input.title,
        description: input.description,
        stopCondition: input.stop_condition ?? null,
        parentGoalId: input.parent_goal_id ?? null,
        maxIterations: input.max_iterations ?? null,
      });
    },

    async status(input: z.infer<typeof goalStatusSchema>) {
      const goal = await services.goals.get(input.goal_id);
      if (!goal) throw new Error(`Goal ${input.goal_id} not found`);
      return goal;
    },

    async list(input: z.infer<typeof goalListSchema> & { projectId?: string }) {
      return services.goals.list({
        projectId: input.project_id ?? input.projectId,
        agentId: input.agent_id,
        status: input.status,
        parentGoalId: input.parent_goal_id ?? undefined,
      });
    },

    async complete(input: z.infer<typeof goalCompleteSchema>) {
      return services.goals.complete(input.goal_id, input.summary ?? undefined);
    },

    async claim(input: z.infer<typeof goalClaimSchema>) {
      return services.goals.claim(input.goal_id, input.agent_id);
    },

    async pause(input: z.infer<typeof goalPauseSchema>) {
      return services.goals.pause(input.goal_id, input.progress ?? undefined, input.summary ?? undefined);
    },

    async incrementIteration(input: z.infer<typeof goalIncrementIterationSchema>) {
      return services.goals.incrementIteration(input.goal_id);
    },
  };
}
