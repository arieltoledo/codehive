import fs from "node:fs/promises";
import path from "node:path";
import type { EventBus } from "./events.js";

export interface MemoryFile {
  filename: string;
  projectId: string;
  status: "pending" | "approved" | "none";
  type: "markdown" | "image" | "pdf" | "other";
  updatedAt: Date;
}

export class MemoryService {
  private readonly baseDir = path.join(process.cwd(), ".agents/memory");

  constructor(private readonly events?: EventBus) {}

  private getFileType(filename: string): MemoryFile["type"] {
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".md") return "markdown";
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "image";
    if (ext === ".pdf") return "pdf";
    return "other";
  }

  async listFiles(projectId: string): Promise<MemoryFile[]> {
    const projectDir = path.join(this.baseDir, projectId);
    try {
      await fs.mkdir(projectDir, { recursive: true });
      const entries = await fs.readdir(projectDir, { withFileTypes: true });
      
      const files = await Promise.all(
        entries
          .filter(e => e.isFile())
          .map(async e => {
            const stats = await fs.stat(path.join(projectDir, e.name));
            let status: "pending" | "approved" | "none" = "none";
            if (e.name.endsWith(".pending.md")) status = "pending";
            if (e.name.endsWith(".approved.md")) status = "approved";
            
            return {
              filename: e.name,
              projectId,
              status,
              type: this.getFileType(e.name),
              updatedAt: stats.mtime
            };
          })
      );

      return files.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      return [];
    }
  }

  async readFile(projectId: string, filename: string): Promise<{ content: Buffer; type: string }> {
    const filePath = path.join(this.baseDir, projectId, filename);
    try {
      const content = await fs.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      let type = "application/octet-stream";
      if (ext === ".md") type = "text/markdown";
      else if (ext === ".pdf") type = "application/pdf";
      else if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) type = `image/${ext.slice(1)}`;
      
      return { content, type };
    } catch (error) {
      throw new Error(`File not found: ${filename}`);
    }
  }

  async publishFile(projectId: string, filename: string, content: string | Buffer): Promise<MemoryFile> {
    const projectDir = path.join(this.baseDir, projectId);
    await fs.mkdir(projectDir, { recursive: true });

    let safeFilename = filename;
    let status: "pending" | "approved" | "none" = "none";

    const isMarkdown = path.extname(filename).toLowerCase() === ".md";

    if (isMarkdown) {
      if (safeFilename.endsWith(".pending.md")) status = "pending";
      else if (safeFilename.endsWith(".approved.md")) status = "approved";
      else {
        if (safeFilename.toLowerCase().includes("plan") || safeFilename.toLowerCase().includes("proposal")) {
          safeFilename = safeFilename.replace(".md", ".pending.md");
          status = "pending";
        }
      }
    }

    const filePath = path.join(projectDir, safeFilename);
    await fs.writeFile(filePath, content);
    
    const stats = await fs.stat(filePath);
    const file: MemoryFile = {
      filename: safeFilename,
      projectId,
      status,
      type: this.getFileType(safeFilename),
      updatedAt: stats.mtime
    };

    this.events?.emit("memory_updated" as any, file);
    return file;
  }

  async approveFile(projectId: string, filename: string): Promise<MemoryFile> {
    if (!filename.endsWith(".pending.md")) {
      throw new Error("Only .pending.md files can be approved");
    }

    const oldPath = path.join(this.baseDir, projectId, filename);
    const newFilename = filename.replace(".pending.md", ".approved.md");
    const newPath = path.join(this.baseDir, projectId, newFilename);

    await fs.rename(oldPath, newPath);
    const stats = await fs.stat(newPath);

    const file: MemoryFile = {
      filename: newFilename,
      projectId,
      status: "approved",
      type: "markdown",
      updatedAt: stats.mtime
    };

    this.events?.emit("memory_updated" as any, file);
    return file;
  }
}
