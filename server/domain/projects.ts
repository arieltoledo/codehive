import type { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import type { EventBus } from "./events.js";

export class ProjectService {
  private readonly memoryDir = path.join(process.cwd(), ".agents/memory");

  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus
  ) {}

  async ensure(projectId: string): Promise<void> {
    await this.prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: { id: projectId, name: projectId },
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    if (projectId === "local") {
      throw new Error("The 'local' project cannot be deleted.");
    }

    // 1. Delete from Database (Cascade will handle agents, tasks, messages, etc.)
    await this.prisma.project.delete({
      where: { id: projectId }
    });

    // 2. Delete physical memory folder
    const projectDir = path.join(this.memoryDir, projectId);
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to delete memory directory for project ${projectId}:`, error);
    }

    // 3. Emit event (optional, but good for UI sync)
    this.events?.emit("project_deleted" as any, { projectId });
  }
}
