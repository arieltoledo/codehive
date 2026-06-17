import fs from "node:fs/promises";
import path from "node:path";
import type { EventBus } from "./events.js";

export interface MemoryFile {
  filename: string;
  projectId: string;
  updatedAt: Date;
}

export class MemoryService {
  private readonly baseDir = path.join(process.cwd(), ".agents/memory");

  constructor(private readonly events?: EventBus) {}

  async listFiles(projectId: string): Promise<MemoryFile[]> {
    const projectDir = path.join(this.baseDir, projectId);
    try {
      await fs.mkdir(projectDir, { recursive: true });
      const entries = await fs.readdir(projectDir, { withFileTypes: true });
      
      const files = await Promise.all(
        entries
          .filter(e => e.isFile() && e.name.endsWith(".md"))
          .map(async e => {
            const stats = await fs.stat(path.join(projectDir, e.name));
            return {
              filename: e.name,
              projectId,
              updatedAt: stats.mtime
            };
          })
      );

      return files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      return [];
    }
  }

  async readFile(projectId: string, filename: string): Promise<string> {
    const filePath = path.join(this.baseDir, projectId, filename);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch (error) {
      throw new Error(`File not found: ${filename}`);
    }
  }

  async publishFile(projectId: string, filename: string, content: string): Promise<MemoryFile> {
    const projectDir = path.join(this.baseDir, projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const safeFilename = filename.endsWith(".md") ? filename : `${filename}.md`;
    const filePath = path.join(projectDir, safeFilename);

    await fs.writeFile(filePath, content, "utf-8");
    const stats = await fs.stat(filePath);

    const file = {
      filename: safeFilename,
      projectId,
      updatedAt: stats.mtime
    };

    // Use a special event type for memory updates
    this.events?.emit("memory_updated" as any, file);
    return file;
  }
}
