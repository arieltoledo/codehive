import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { EventBus } from "./events.js";
import type { SubagentDef, SubagentSchema, AgentType, SubagentInstanceRecord } from "./types.js";

const AGENTS_DIR = ".codehive/agents";
const CONFIG_FILE = ".codehive/config.json";

interface ProjectConfig {
  projectRoot: string;
}

const SCHEMAS: Record<string, SubagentSchema> = {
  codex: {
    agentType: "codex",
    format: "toml",
    nativeDir: ".codex/agents",
    nativeExt: ".toml",
    fields: [
      { name: "name", label: "Name", type: "string", required: true },
      { name: "description", label: "Description", type: "string" },
      { name: "developer_instructions", label: "Developer Instructions", type: "textarea", required: true },
      { name: "model", label: "Model", type: "select", options: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.3-codex-spark"] },
      { name: "model_reasoning_effort", label: "Reasoning Effort", type: "select", options: ["low", "medium", "high"] },
      { name: "sandbox_mode", label: "Sandbox Mode", type: "select", options: ["read-only", "workspace-write", "danger-full-access"] },
      { name: "nickname_candidates", label: "Nickname Candidates", type: "string" },
      { name: "mcp_servers", label: "MCP Servers (JSON)", type: "string" },
    ],
  },
  "claude-code": {
    agentType: "claude-code",
    format: "markdown",
    nativeDir: ".claude/agents",
    nativeExt: ".md",
    fields: [
      { name: "name", label: "Name", type: "string", required: true },
      { name: "description", label: "Description", type: "string" },
      { name: "instructions", label: "System Prompt / Instructions", type: "textarea", required: true },
      { name: "model", label: "Model", type: "select", options: ["sonnet", "opus", "haiku", "claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5", "inherit"] },
      { name: "permission_mode", label: "Permission Mode", type: "select", options: ["default", "restricted", "full", "inherit"] },
      { name: "tools", label: "Tools (comma-separated)", type: "string" },
    ],
  },
  opencode: {
    agentType: "opencode",
    format: "json",
    nativeDir: ".opencode/agents",
    nativeExt: ".json",
    fields: [
      { name: "name", label: "Name", type: "string", required: true },
      { name: "description", label: "Description", type: "string" },
      { name: "prompt", label: "Prompt / Instructions", type: "textarea", required: true },
      { name: "model", label: "Model", type: "select", options: ["opencode/gpt-5.5", "opencode/gpt-5.4", "opencode/gpt-5.4-mini", "opencode/gpt-5.4-nano", "opencode/claude-sonnet-4-6", "opencode/claude-haiku-4-5", "opencode/gemini-3.5-flash", "opencode/gemini-3.1-pro", "other"] },
      { name: "mode", label: "Mode", type: "select", options: ["primary", "subagent"] },
      { name: "permission", label: "Permission", type: "select", options: ["default", "restricted", "full"] },
      { name: "color", label: "Color (hex)", type: "string" },
      { name: "steps", label: "Steps", type: "number" },
    ],
  },
  antigravity: {
    agentType: "antigravity",
    format: "json",
    nativeDir: ".agents",
    nativeExt: ".json",
    fields: [
      { name: "name", label: "Name", type: "string", required: true },
      { name: "description", label: "Description", type: "string" },
      { name: "system_instruction", label: "System Instruction", type: "textarea", required: true },
      { name: "model", label: "Model", type: "select", options: ["gemini-3.5-flash", "gemini-3.1-pro", "gemini-3-flash", "gemini-3-deep-think", "claude-sonnet-4-6", "claude-opus-4-6", "gpt-oss-120b"] },
      { name: "tools", label: "Tools (comma-separated)", type: "string" },
      { name: "base_environment", label: "Base Environment", type: "select", options: ["remote", "existing"] },
    ],
  },
};

function getSchema(agentType: string): SubagentSchema | undefined {
  return SCHEMAS[agentType] ?? SCHEMAS[agentType.toLowerCase()];
}

function detectAgentType(provider: string): AgentType {
  const p = provider.toLowerCase();
  if (p.includes("codex") || p === "codex") return "codex";
  if (p.includes("claude")) return "claude-code";
  if (p.includes("open") || p.includes("opencode")) return "opencode";
  if (p.includes("anti") || p.includes("gravity")) return "antigravity";
  return "generic";
}

function getAgentsDir(root: string): string {
  return path.join(root, AGENTS_DIR);
}

export async function findProjectRoot(start?: string): Promise<string> {
  let dir = start ? path.resolve(start) : process.cwd();
  for (let i = 0; i < 10; i++) {
    try {
      const configPath = path.join(dir, CONFIG_FILE);
      const content = await fs.readFile(configPath, "utf-8");
      const config: ProjectConfig = JSON.parse(content);
      if (config.projectRoot) return path.resolve(config.projectRoot);
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return process.cwd();
}

async function ensureAgentsDir(root: string): Promise<void> {
  await fs.mkdir(getAgentsDir(root), { recursive: true });
}

function toNativeConfig(def: SubagentDef): string | null {
  const schema = getSchema(def.agentType);
  if (!schema) return null;

  if (schema.format === "toml") {
    const lines: string[] = [`name = "${def.name}"`];
    if (def.fields.description) lines.push(`description = "${def.fields.description}"`);
    if (def.fields.developer_instructions) {
      lines.push(`developer_instructions = """\n${def.fields.developer_instructions}\n"""`);
    }
    for (const [key, val] of Object.entries(def.fields)) {
      if (key === "name" || key === "description" || key === "developer_instructions") continue;
      if (val === undefined || val === null || val === "") continue;
      if (typeof val === "boolean") lines.push(`${key} = ${val}`);
      else if (typeof val === "number") lines.push(`${key} = ${val}`);
      else lines.push(`${key} = "${val}"`);
    }
    return lines.join("\n") + "\n";
  }

  if (schema.format === "markdown") {
    const lines: string[] = [];
    lines.push("---");
    lines.push(`name: ${def.name}`);
    const fields: Record<string, string> = {};
    for (const field of schema.fields) {
      const val = (def.fields as any)[field.name];
      if (val && typeof val === "string") {
        if (field.type === "textarea") {
          lines.push(`${field.name}: |`);
          lines.push(`  ${val.replace(/\n/g, "\n  ")}`);
        } else {
          lines.push(`${field.name}: ${val}`);
        }
      }
    }
    lines.push("---");
    const instr = String(def.fields.instructions || def.fields.developer_instructions || "");
    if (instr) {
      lines.push("");
      lines.push(instr);
    }
    return lines.join("\n") + "\n";
  }

  if (schema.format === "json") {
    if (def.agentType === "opencode") {
      const obj: Record<string, any> = {};
      for (const field of schema.fields) {
        const val = (def.fields as any)[field.name];
        if (val !== undefined && val !== null && val !== "") {
          if (field.type === "number") obj[field.name] = Number(val);
          else obj[field.name] = val;
        }
      }
      return JSON.stringify(obj, null, 2) + "\n";
    }
    const obj: Record<string, any> = {};
    for (const field of schema.fields) {
      const val = (def.fields as any)[field.name];
      if (val !== undefined && val !== null && val !== "") {
        if (field.type === "number") obj[field.name] = Number(val);
        else obj[field.name] = val;
      }
    }
    return JSON.stringify(obj, null, 2) + "\n";
  }

  return null;
}

interface TemplateResult {
  id: string;
  name: string;
  description: string;
  instructions: string;
  agentType: string;
  source: string;
  fields: Record<string, string | number | boolean>;
}

const COMMUNITY_API_TIMEOUT = 5000;

async function fetchWithTimeout(url: string, timeoutMs = COMMUNITY_API_TIMEOUT): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch {
    return null;
  }
}

async function searchClaudePlugins(q: string): Promise<TemplateResult[]> {
  try {
    const res = await fetchWithTimeout(`https://claude-plugins.dev/api/skills?q=${encodeURIComponent(q)}`);
    if (!res || !res.ok) return [];
    const data = await res.json() as any;
    const items = Array.isArray(data) ? data : data.skills ?? data.results ?? [];
    return items.slice(0, 15).map((item: any, i: number) => ({
      id: `claude-plugins-${i}`,
      name: item.name ?? item.title ?? `skill-${i}`,
      description: item.description ?? item.excerpt ?? "",
      instructions: item.instructions ?? item.prompt ?? item.content ?? item.description ?? "",
      agentType: detectAgentTypeSimple(item.platform ?? item.target ?? ""),
      source: "claude-plugins.dev",
      fields: {},
    }));
  } catch {
    return [];
  }
}

function detectAgentTypeSimple(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes("codex")) return "codex";
  if (p.includes("claude")) return "claude-code";
  if (p.includes("open") || p.includes("opencode")) return "opencode";
  return "generic";
}

const BUILTIN_TEMPLATES: TemplateResult[] = [
  {
    id: "builtin-code-reviewer",
    name: "Code Reviewer",
    description: "Reviews pull requests for bugs, style issues, and security vulnerabilities",
    instructions: "You are a thorough code reviewer. Analyze the provided code diff for bugs, security issues, style violations, and performance problems. Provide specific, actionable feedback with line numbers.",
    agentType: "codex",
    source: "builtin",
    fields: { model: "gpt-5.4", sandbox_mode: "read-only" },
  },
  {
    id: "builtin-doc-writer",
    name: "Documentation Writer",
    description: "Generates comprehensive documentation from source code",
    instructions: "You are a technical documentation writer. Read the provided source code and generate clear, comprehensive documentation including API references, usage examples, and architecture notes.",
    agentType: "codex",
    source: "builtin",
    fields: { model: "gpt-5.4-mini", sandbox_mode: "read-only" },
  },
  {
    id: "builtin-test-generator",
    name: "Test Generator",
    description: "Creates unit and integration tests from implementation code",
    instructions: "You are a test engineering specialist. Write comprehensive unit tests and integration tests for the provided code. Follow the existing test patterns in the project.",
    agentType: "claude-code",
    source: "builtin",
    fields: { model: "claude-sonnet-4-6", permission_mode: "default" },
  },
  {
    id: "builtin-frontend-dev",
    name: "Frontend Developer",
    description: "Builds UI components and pages from specifications",
    instructions: "You are a frontend developer. Implement the requested UI components using React + TypeScript + Tailwind CSS. Match the existing design patterns and ensure responsive layout.",
    agentType: "opencode",
    source: "builtin",
    fields: { model: "opencode/gpt-5.4-mini", mode: "subagent", permission: "default" },
  },
  {
    id: "builtin-qa-engineer",
    name: "QA Engineer",
    description: "Runs manual test suites and reports bugs with reproduction steps",
    instructions: "You are a QA engineer. Execute test cases methodically, document actual vs expected results, and file detailed bug reports with reproduction steps, screenshots, and severity assessment.",
    agentType: "claude-code",
    source: "builtin",
    fields: { model: "claude-haiku-4-5", permission_mode: "default" },
  },
  {
    id: "builtin-security-auditor",
    name: "Security Auditor",
    description: "Scans code for OWASP Top 10 vulnerabilities and misconfigurations",
    instructions: "You are a security auditor. Review the codebase for OWASP Top 10 vulnerabilities, hardcoded secrets, insecure dependencies, and misconfigurations. Prioritize findings by severity.",
    agentType: "codex",
    source: "builtin",
    fields: { model: "gpt-5.5", sandbox_mode: "read-only" },
  },
  {
    id: "builtin-refactoring-engineer",
    name: "Refactoring Engineer",
    description: "Safely restructures code while preserving behavior",
    instructions: "You are a refactoring specialist. Analyze the code for improvement opportunities and apply safe refactoring patterns. Preserve all existing behavior while improving readability, performance, and maintainability.",
    agentType: "opencode",
    source: "builtin",
    fields: { model: "opencode/gpt-5.4", mode: "subagent", permission: "default" },
  },
  {
    id: "builtin-db-specialist",
    name: "Database Specialist",
    description: "Designs schemas, writes migrations, and optimizes queries",
    instructions: "You are a database specialist. Design schemas, write SQL migrations, optimize queries, and suggest indexing strategies. Consider the specific database technology (PostgreSQL, SQLite, etc.) in use.",
    agentType: "codex",
    source: "builtin",
    fields: { model: "gpt-5.4", sandbox_mode: "workspace-write" },
  },
];

export class SubagentService {
  private _projectRoot: string | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly events?: EventBus
  ) {}

  async getProjectRoot(): Promise<string> {
    if (this._projectRoot) return this._projectRoot;
    this._projectRoot = await findProjectRoot();
    return this._projectRoot;
  }

  setProjectRoot(root: string): void {
    this._projectRoot = path.resolve(root);
  }

  async list(projectRoot?: string): Promise<SubagentDef[]> {
    const root = projectRoot || await this.getProjectRoot();
    const dir = getAgentsDir(root);
    try {
      await fs.mkdir(dir, { recursive: true });
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const defs: SubagentDef[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        try {
          const content = await fs.readFile(path.join(dir, entry.name), "utf-8");
          const def = JSON.parse(content) as SubagentDef;
          defs.push(def);
        } catch {}
      }
      return defs.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  async get(name: string, projectRoot?: string): Promise<SubagentDef | null> {
    const root = projectRoot || await this.getProjectRoot();
    const filePath = path.join(getAgentsDir(root), `${name}.json`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as SubagentDef;
    } catch {
      return null;
    }
  }

  async create(def: SubagentDef, projectRoot?: string): Promise<SubagentDef> {
    const root = projectRoot || await this.getProjectRoot();
    await ensureAgentsDir(root);
    const filePath = path.join(getAgentsDir(root), `${def.name}.json`);
    const existing = await this.get(def.name, root);
    if (existing) throw new Error(`Subagent "${def.name}" already exists`);

    def.createdAt = def.createdAt || new Date().toISOString();
    def.configWritten = false;
    def.configPath = null;

    await fs.writeFile(filePath, JSON.stringify(def, null, 2), "utf-8");
    this.events?.emit("subagent_created" as any, def);
    return def;
  }

  async update(name: string, updates: Partial<SubagentDef>, projectRoot?: string): Promise<SubagentDef> {
    const root = projectRoot || await this.getProjectRoot();
    const existing = await this.get(name, root);
    if (!existing) throw new Error(`Subagent "${name}" not found`);

    const updated = { ...existing, ...updates, name: existing.name };
    const filePath = path.join(getAgentsDir(root), `${name}.json`);
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  }

  async remove(name: string, projectRoot?: string): Promise<void> {
    const root = projectRoot || await this.getProjectRoot();
    const filePath = path.join(getAgentsDir(root), `${name}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
      throw new Error(`Subagent "${name}" not found`);
    }
  }

  async createInstance(name: string, projectRoot?: string): Promise<SubagentInstanceRecord> {
    const root = projectRoot || await this.getProjectRoot();
    const def = await this.get(name, root);
    if (!def) throw new Error(`Subagent "${name}" not found`);

    // Find matching project or use "local"
    const dirName = path.basename(root);
    let projectId = "local";
    try {
      const project = await this.prisma.project.findFirst({
        where: { OR: [{ id: dirName }, { name: dirName }] },
      });
      if (project) projectId = project.id;
    } catch {}

    const rec = await this.prisma.subagentInstance.create({
      data: {
        projectId,
        subagentName: def.name,
        agentType: def.agentType,
        targetAgentId: def.targetAgentId,
        status: "running",
      },
    });

    const instance: SubagentInstanceRecord = {
      id: rec.id,
      projectId: rec.projectId,
      subagentName: rec.subagentName,
      agentType: rec.agentType as AgentType,
      targetAgentId: rec.targetAgentId,
      status: rec.status as SubagentInstanceRecord["status"],
      createdAt: rec.createdAt,
      finishedAt: rec.finishedAt,
    };

    this.events?.emit("subagent_instance_created" as any, instance);
    return instance;
  }

  async listInstances(projectRoot?: string, status?: string): Promise<SubagentInstanceRecord[]> {
    const root = projectRoot || await this.getProjectRoot();
    const dirName = path.basename(root);
    let projectId = "local";
    try {
      const project = await this.prisma.project.findFirst({
        where: { OR: [{ id: dirName }, { name: dirName }] },
      });
      if (project) projectId = project.id;
    } catch {}
    const where: any = { projectId };
    if (status) where.status = status;

    const records = await this.prisma.subagentInstance.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      subagentName: r.subagentName,
      agentType: r.agentType as AgentType,
      targetAgentId: r.targetAgentId,
      status: r.status as SubagentInstanceRecord["status"],
      createdAt: r.createdAt,
      finishedAt: r.finishedAt,
    }));
  }

  async completeInstance(name: string, projectRoot?: string): Promise<SubagentInstanceRecord> {
    const root = projectRoot || await this.getProjectRoot();
    const dirName = path.basename(root);
    let projectId = "local";
    try {
      const project = await this.prisma.project.findFirst({
        where: { OR: [{ id: dirName }, { name: dirName }] },
      });
      if (project) projectId = project.id;
    } catch {}
    const instance = await this.prisma.subagentInstance.findFirst({
      where: {
        subagentName: name,
        projectId,
        status: "running",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!instance) throw new Error(`No running instance found for subagent "${name}"`);

    const updated = await this.prisma.subagentInstance.update({
      where: { id: instance.id },
      data: { status: "completed", finishedAt: new Date() },
    });

    const record: SubagentInstanceRecord = {
      id: updated.id,
      projectId: updated.projectId,
      subagentName: updated.subagentName,
      agentType: updated.agentType as AgentType,
      targetAgentId: updated.targetAgentId,
      status: updated.status as SubagentInstanceRecord["status"],
      createdAt: updated.createdAt,
      finishedAt: updated.finishedAt,
    };

    this.events?.emit("subagent_instance_completed" as any, record);
    return record;
  }

  async failInstance(name: string, projectRoot?: string): Promise<SubagentInstanceRecord> {
    const root = projectRoot || await this.getProjectRoot();
    const dirName = path.basename(root);
    let projectId = "local";
    try {
      const project = await this.prisma.project.findFirst({
        where: { OR: [{ id: dirName }, { name: dirName }] },
      });
      if (project) projectId = project.id;
    } catch {}
    const instance = await this.prisma.subagentInstance.findFirst({
      where: {
        subagentName: name,
        projectId,
        status: "running",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!instance) throw new Error(`No running instance found for subagent "${name}"`);

    const updated = await this.prisma.subagentInstance.update({
      where: { id: instance.id },
      data: { status: "error", finishedAt: new Date() },
    });

    const record: SubagentInstanceRecord = {
      id: updated.id,
      projectId: updated.projectId,
      subagentName: updated.subagentName,
      agentType: updated.agentType as AgentType,
      targetAgentId: updated.targetAgentId,
      status: updated.status as SubagentInstanceRecord["status"],
      createdAt: updated.createdAt,
      finishedAt: updated.finishedAt,
    };

    this.events?.emit("subagent_instance_error" as any, record);
    return record;
  }

  async searchTemplates(q: string): Promise<TemplateResult[]> {
    const lower = q.toLowerCase().trim();
    const builtin = BUILTIN_TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.instructions.toLowerCase().includes(lower)
    );

    const [community, _agenstskills] = await Promise.all([
      searchClaudePlugins(q),
      Promise.resolve([] as TemplateResult[]),
    ]);

    const seen = new Set<string>();
    const all = [...builtin, ...community];
    return all.filter((t) => {
      const key = `${t.source}:${t.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async launch(name: string, projectRoot?: string): Promise<{ configWritten: boolean; configPath: string | null; error?: string }> {
    const root = projectRoot || await this.getProjectRoot();

    // Create a running instance
    const instance = await this.createInstance(name, root);

    return {
      configWritten: false,
      configPath: null,
    };
  }

  getSchemaForAgentType(agentType: string): SubagentSchema | undefined {
    return getSchema(agentType);
  }

  getAllSchemas(): Record<string, SubagentSchema> {
    return { ...SCHEMAS };
  }

  detectAgentType(provider: string): AgentType {
    return detectAgentType(provider);
  }
}
