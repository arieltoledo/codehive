import { z } from "zod";

import type { DomainServices } from "../../server/domain/services.js";
import { toDecisionDto, toFileClaimDto } from "../../server/http/presenters.js";

export const fileClaimSchema = z.object({
  agent_id: z.string().min(1),
  file_path: z.string().min(1),
  task_id: z.string().min(1).optional(),
  reason: z.string().min(1)
});

export const fileReleaseSchema = z.object({
  agent_id: z.string().min(1),
  file_path: z.string().min(1)
});

export const decisionRecordSchema = z.object({
  agent_id: z.string().min(1),
  decision: z.string().min(1),
  reason: z.string().min(1),
  task_id: z.string().min(1).optional()
});

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";

export function createTraceabilityToolHandlers(services: DomainServices) {
  return {
    claimFile: async (input: unknown) => {
      const parsed = fileClaimSchema.parse(input);
      const response = await fetch(`${API_URL}/api/traceability/claim-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to claim file via API");
      }

      const claim = await response.json();
      return { claim };
    },
    releaseFile: async (input: unknown) => {
      const parsed = fileReleaseSchema.parse(input);
      const response = await fetch(`${API_URL}/api/traceability/release-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to release file via API");
      }

      const claim = await response.json();
      return { claim };
    },
    recordDecision: async (input: unknown) => {
      const parsed = decisionRecordSchema.parse(input);
      const response = await fetch(`${API_URL}/api/traceability/record-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.error?.message ?? "Failed to record decision via API");
      }

      const decision = await response.json();
      return { decision };
    }
  };
}
