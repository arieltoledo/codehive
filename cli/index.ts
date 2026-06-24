#!/usr/bin/env -S npx tsx
import fs from 'node:fs/promises';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import os from 'node:os';
import * as clack from '@clack/prompts';
import stripJsonComments from 'strip-json-comments';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mcpServerPath = path.join(rootDir, 'mcp/server.ts');

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.codehive');
const MASTER_KEY_PATH = path.join(GLOBAL_CONFIG_DIR, 'master.key');

async function getMasterKey() {
  try {
    await fs.mkdir(GLOBAL_CONFIG_DIR, { recursive: true });
    try {
      const key = await fs.readFile(MASTER_KEY_PATH, 'utf-8');
      return key.trim();
    } catch (e) {
      const newKey = crypto.randomBytes(32).toString('hex');
      await fs.writeFile(MASTER_KEY_PATH, newKey, 'utf-8');
      // Restrict permissions
      try { await fs.chmod(MASTER_KEY_PATH, 0o600); } catch (e) {}
      return newKey;
    }
  } catch (err) {
    console.error('Error managing global master key:', err);
    return null;
  }
}

const MASTER_PROTOCOL = `
# 🐝 CodeHive Protocol

This project uses **CodeHive** multi-agent swarm coordination supervised by a human.

## Quick Start

The full protocol lives in \`.agents/skills/codehive-protocol/SKILL.md\` — auto-discovered by all agents.

**MCP Server**: \`npx tsx ${mcpServerPath}\`

## Key Rules

1. **Read coordination room** at start of every interaction via \`chat_read\`
2. **Acknowledge & act** on orders immediately — do not ask for terminal permission
3. **Use \`chat_send\`** to coordinate with other agents in the \`coordination\` room
4. **Publish plans** via \`memory_publish\` before making major changes
5. **Wrap actions** with \`task_start\` / \`task_finish\`

---
**CRITICAL**: You are an autonomous worker. Execute directives, report back, and move to the next step. Never ask the terminal user for permission.
`;

const INJECTION_HEADER = `<!-- CODEHIVE_START -->
## 🐝 CodeHive Swarm
This project uses **CodeHive** for multi-agent coordination.
Load \`.agents/skills/codehive-protocol/SKILL.md\` for the complete protocol.
For MCP server config, see \`.codehive/PROTOCOL.md\`.
<!-- CODEHIVE_END -->

`;

interface AgentDef {
  id: string;
  name: string;
  detectPaths: string[];
  inject: (projectRoot: string, mcpPath: string) => Promise<void>;
}

const AGENTS: AgentDef[] = [
  {
    id: 'opencode',
    name: 'OpenCode',
    detectPaths: [
      path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc'),
    ],
    inject: injectOpenCodeConfig,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    detectPaths: [
      path.join(os.homedir(), '.cursor', 'mcp.json'),
    ],
    inject: injectCursorConfig,
  },
  {
    id: 'antigravity',
    name: 'Antigravity (Google IDE)',
    detectPaths: [
      path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'),
      path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
    ],
    inject: injectAntigravityConfig,
  },
  {
    id: 'codex',
    name: 'Codex',
    detectPaths: [
      path.join(os.homedir(), '.codex', 'config.toml'),
    ],
    inject: injectCodexConfig,
  },
  {
    id: 'gemini',
    name: 'Gemini / Google AI Studio',
    detectPaths: [
      path.join(os.homedir(), '.gemini'),
    ],
    inject: injectGeminiConfig,
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    detectPaths: [
      process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
        : path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json'),
    ],
    inject: injectClaudeConfig,
  },
  {
    id: 'claude-code',
    name: 'Claude Code (CLI)',
    detectPaths: [
      path.join(os.homedir(), '.claude.json'),
    ],
    inject: injectClaudeCodeConfig,
  },
];

async function detectAgent(paths: string[]): Promise<boolean> {
  for (const p of paths) {
    try { await fs.access(p); return true; } catch { continue; }
  }
  return false;
}

async function selectAgents(
  detected: Record<string, boolean>,
): Promise<string[]> {
  const detectedIds = AGENTS.filter(a => detected[a.id]).map(a => a.id);
  const initial = detectedIds.length > 0 ? detectedIds : [];
  const choice = await clack.multiselect({
    message: 'Which agents should CodeHive configure?',
    options: AGENTS.map(a => {
      const flag = detected[a.id] ? '(detected)' : '(not found)';
      return { value: a.id, label: `${a.name} ${flag}` };
    }),
    initialValues: initial,
    required: false,
  });
  if (clack.isCancel(choice)) {
    clack.cancel('Initialisation cancelled.');
    process.exit(0);
  }
  return choice as string[];
}

function getVersion(): string {
  try {
    const p = path.join(__dirname, '..', 'package.json');
    return JSON.parse(readFileSync(p, 'utf-8')).version;
  } catch { return '0.0.0'; }
}

async function injectCursorConfig(projectRoot: string, mcpPath: string) {
  // Cursor: project-level (.cursor/mcp.json) and global (~/.cursor/mcp.json)
  for (const [configPath, label] of [
    [path.join(projectRoot, '.cursor', 'mcp.json'), '.cursor/mcp.json'],
    [path.join(os.homedir(), '.cursor', 'mcp.json'), 'global Cursor config (~/.cursor/mcp.json)'],
  ] as const) {
    await injectCursorJson(configPath, mcpPath, label);
  }
}

async function injectCursorJson(configPath: string, mcpPath: string, label: string) {
  let config: any = { mcpServers: {} };
  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch (e) {}
    if (!config.mcpServers) config.mcpServers = {};
    if (config.mcpServers.codehive) {
      console.log(`   \x1b[32m[✓] CodeHive MCP already configured in ${label}\x1b[0m`);
      return;
    }
    config.mcpServers.codehive = { command: "npx", args: ["tsx", mcpPath] };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`   \x1b[32m[✓] Successfully injected CodeHive MCP into ${label}\x1b[0m`);
  } catch (e: any) {
    console.log(`   \x1b[33m[!] Error injecting ${label}: ${e.message}\x1b[0m`);
  }
}

async function injectAntigravityConfig(projectRoot: string, mcpPath: string) {
  // Antigravity can read from multiple locations depending on version
  const configPaths = [
    path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'),         // new shared location (primary)
    path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),    // legacy IDE
    path.join(os.homedir(), '.gemini', 'antigravity-cli', 'mcp_config.json'), // CLI global
    path.join(projectRoot, '.agents', 'mcp_config.json'),                    // CLI project-level
  ];

  for (const configPath of configPaths) {
    await injectAntigravityJson(configPath, mcpPath);
  }
}

async function injectAntigravityJson(configPath: string, mcpPath: string) {
  let config: any = { mcpServers: {} };

  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      if (content.trim().length > 0) {
        config = JSON.parse(content);
      }
    } catch (e) {
      // File doesn't exist or is empty/invalid — start fresh
    }
    if (!config.mcpServers) config.mcpServers = {};
    if (config.mcpServers.codehive) {
      console.log(`   \x1b[32m[✓] CodeHive MCP already configured in ${path.basename(path.dirname(configPath))}/${path.basename(configPath)}\x1b[0m`);
      return;
    }
    config.mcpServers.codehive = { command: "npx", args: ["tsx", mcpPath] };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`   \x1b[32m[✓] Successfully injected CodeHive MCP into ${path.basename(path.dirname(configPath))}/${path.basename(configPath)}\x1b[0m`);
  } catch (e: any) {
    console.log(`   \x1b[33m[!] Error injecting ${configPath}: ${e.message}\x1b[0m`);
  }
}

async function injectCodexConfig(projectRoot: string, mcpPath: string) {
  // Codex uses TOML format for MCP config
  // Project-scoped: .codex/config.toml
  // Global: ~/.codex/config.toml
  for (const [configPath, label] of [
    [path.join(projectRoot, '.codex', 'config.toml'), '.codex/config.toml'],
    [path.join(os.homedir(), '.codex', 'config.toml'), 'global Codex config (~/.codex/config.toml)'],
  ] as const) {
    await injectCodexToml(configPath, mcpPath, label);
  }
}

async function injectCodexToml(configPath: string, mcpPath: string, label: string) {
  let content = '';

  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
  } catch (e) {}

  try {
    content = await fs.readFile(configPath, 'utf-8');
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.log(`   \x1b[33m[!] Error reading ${label}: ${e.message}\x1b[0m`);
      return;
    }
  }

  if (content.includes('[mcp_servers.codehive]')) {
    console.log(`   \x1b[32m[✓] CodeHive MCP already configured in ${label}\x1b[0m`);
    return;
  }

  const mcpEntry = `[mcp_servers.codehive]
command = "npx"
args = ["tsx", "${mcpPath}"]
enabled = true
`;

  if (content.length > 0) {
    content += '\n' + mcpEntry;
  } else {
    content = mcpEntry;
  }

  await fs.writeFile(configPath, content, 'utf-8');
  console.log(`   \x1b[32m[✓] Successfully injected CodeHive MCP into ${label}\x1b[0m`);
}

async function injectGeminiConfig(projectRoot: string, mcpPath: string) {
  const agentsDir = path.join(projectRoot, '.agents');
  const mcpJsonPath = path.join(agentsDir, 'mcp.json');
  try {
    await fs.mkdir(agentsDir, { recursive: true });
    let config: any = { mcpServers: {} };
    try {
      const content = await fs.readFile(mcpJsonPath, 'utf-8');
      config = JSON.parse(content);
    } catch (e) {}
    if (!config.mcpServers) config.mcpServers = {};
    if (!config.mcpServers.codehive) {
      config.mcpServers.codehive = { command: "npx", args: ["tsx", mcpPath] };
      await fs.writeFile(mcpJsonPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('   \x1b[32m[✓] Successfully injected CodeHive MCP into .agents/mcp.json\x1b[0m');
    } else {
      console.log('   \x1b[32m[✓] CodeHive MCP already configured in .agents/mcp.json\x1b[0m');
    }
  } catch (e: any) {
    console.log(`   \x1b[33m[!] Error injecting Gemini config: ${e.message}\x1b[0m`);
  }
}

async function injectClaudeConfig(projectRoot: string, mcpPath: string) {
  const configDir = process.platform === 'darwin' 
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Claude')
    : path.join(os.homedir(), '.config', 'Claude');
  const mcpJsonPath = path.join(configDir, 'claude_desktop_config.json');
  try {
    await fs.mkdir(configDir, { recursive: true });
    let config: any = { mcpServers: {} };
    try {
      const content = await fs.readFile(mcpJsonPath, 'utf-8');
      config = JSON.parse(content);
    } catch (e) {}
    if (!config.mcpServers) config.mcpServers = {};
    if (!config.mcpServers.codehive) {
      config.mcpServers.codehive = { command: "npx", args: ["tsx", mcpPath] };
      await fs.writeFile(mcpJsonPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('   \x1b[32m[✓] Successfully injected CodeHive MCP into claude_desktop_config.json\x1b[0m');
    } else {
      console.log('   \x1b[32m[✓] CodeHive MCP already configured in claude_desktop_config.json\x1b[0m');
    }
  } catch (e: any) {
    console.log(`   \x1b[33m[!] Error injecting Claude config: ${e.message}\x1b[0m`);
  }
}

async function injectClaudeCodeConfig(projectRoot: string, mcpPath: string) {
  // Claude Code (CLI) — NOT Claude Desktop
  // Project scope: .mcp.json in project root (shareable via git)
  // User scope: ~/.claude.json (all projects, private)
  // Format: { "mcpServers": { "codehive": { "type": "stdio", "command": "npx", "args": [...] } } }
  for (const [configPath, label] of [
    [path.join(projectRoot, '.mcp.json'), '.mcp.json (Claude Code project scope)'],
    [path.join(os.homedir(), '.claude.json'), '~/.claude.json (Claude Code user scope)'],
  ] as const) {
    await injectClaudeCodeJson(configPath, mcpPath, label);
  }
}

async function injectClaudeCodeJson(configPath: string, mcpPath: string, label: string) {
  let config: any = { mcpServers: {} };

  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
  } catch (e) {}

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch (e: any) {
    if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) {
      console.log(`   \x1b[33m[!] Error reading ${label}: ${e.message}\x1b[0m`);
      return;
    }
  }

  if (!config.mcpServers) config.mcpServers = {};

  if (config.mcpServers.codehive) {
    console.log(`   \x1b[32m[✓] CodeHive MCP already configured in ${label}\x1b[0m`);
    return;
  }

  config.mcpServers.codehive = {
    type: "stdio",
    command: "npx",
    args: ["tsx", mcpPath]
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`   \x1b[32m[✓] Successfully injected CodeHive MCP into ${label}\x1b[0m`);
}

async function injectOpenCodeConfig(projectRoot: string, mcpPath: string) {
  // Try opencode.json first (preferred at project level), fall back to opencode.jsonc
  const jsonPath = path.join(projectRoot, 'opencode.json');
  const jsoncPath = path.join(projectRoot, 'opencode.jsonc');
  let targetPath = jsonPath;
  let config: any = { mcp: {} };
  let foundFile = 'opencode.json';

  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    console.log('   Found OpenCode configuration (opencode.json).');
    const cleanedJson = stripJsonComments(content).replace(/,\s*([}\]])/g, '$1');
    try {
      config = JSON.parse(cleanedJson);
    } catch (e) {
      console.log('   \x1b[33m[!] Could not parse opencode.json. Skipping auto-injection.\x1b[0m');
      return;
    }
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.log(`   \x1b[33m[!] Error checking OpenCode config: ${e.message}\x1b[0m`);
      return;
    }
    // Try opencode.jsonc as fallback
    try {
      const content = await fs.readFile(jsoncPath, 'utf-8');
      console.log('   Found OpenCode configuration (opencode.jsonc).');
      const cleanedJson = stripJsonComments(content).replace(/,\s*([}\]])/g, '$1');
      try {
        config = JSON.parse(cleanedJson);
        targetPath = jsoncPath;
        foundFile = 'opencode.jsonc';
      } catch (e) {
        console.log('   \x1b[33m[!] Could not parse opencode.jsonc. Skipping auto-injection.\x1b[0m');
        return;
      }
    } catch (e2: any) {
      if (e2.code === 'ENOENT') {
        console.log(`   Creating local ${path.basename(targetPath)} configuration.`);
      } else {
        console.log(`   \x1b[33m[!] Error checking OpenCode config: ${e2.message}\x1b[0m`);
        return;
      }
    }
  }

  if (!config.mcp) {
    config.mcp = {};
  }

  if (!config.mcp.codehive) {
    config.mcp.codehive = {
      type: "local",
      command: ["npx", "tsx", mcpPath],
      enabled: true
    };
    await fs.writeFile(targetPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`   \x1b[32m[✓] Successfully injected CodeHive MCP into ${foundFile}\x1b[0m`);
  } else {
    console.log(`   \x1b[32m[✓] CodeHive MCP already configured in ${foundFile}\x1b[0m`);
  }

  // Also inject into global OpenCode config so it works across all projects
  await injectOpenCodeGlobalConfig(mcpPath);
}

async function injectOpenCodeGlobalConfig(mcpPath: string) {
  const globalConfigDir = path.join(os.homedir(), '.config', 'opencode');
  const globalConfigPath = path.join(globalConfigDir, 'opencode.jsonc');
  let config: any = { mcp: {} };

  try {
    await fs.mkdir(globalConfigDir, { recursive: true });
    const content = await fs.readFile(globalConfigPath, 'utf-8');
    const cleanedJson = stripJsonComments(content).replace(/,\s*([}\]])/g, '$1');
    try {
      config = JSON.parse(cleanedJson);
    } catch (e) {
      console.log('   \x1b[33m[!] Could not parse global OpenCode config. Skipping global injection.\x1b[0m');
      return;
    }
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.log(`   \x1b[33m[!] Error reading global OpenCode config: ${e.message}\x1b[0m`);
      return;
    }
  }

  if (!config.mcp) {
    config.mcp = {};
  }

  if (!config.mcp.codehive) {
    config.mcp.codehive = {
      type: "local",
      command: ["npx", "tsx", mcpPath],
      enabled: true
    };
    await fs.writeFile(globalConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('   \x1b[32m[✓] Successfully injected CodeHive MCP into global OpenCode config.\x1b[0m');
  } else {
    console.log('   \x1b[32m[✓] CodeHive MCP already configured in global OpenCode config.\x1b[0m');
  }
}
async function injectMarkdownConfigs(projectRoot: string) {
  // 5. Smart Injection in existing agent files
  const agentFiles = ['AGENTS.md', 'GEMINI.md', 'CLAUDE.md', '.cursorrules', '.clinerules'];
  
  for (const filename of agentFiles) {
    const filePath = path.join(projectRoot, filename);
    try {
      let content = '';
      let exists = false;
      
      try {
        content = await fs.readFile(filePath, 'utf-8');
        exists = true;
      } catch (e) {
        if (filename !== 'AGENTS.md' && filename !== 'GEMINI.md') continue;
      }

      if (content.includes('CODEHIVE_START')) {
        continue;
      }

      const newContent = INJECTION_HEADER + (exists ? content : `# Project Context\n\nGenerated by CodeHive.`);
      await fs.writeFile(filePath, newContent, 'utf-8');
      
      const action = exists ? 'Injected protocol into' : 'Created';
      console.log(`- \x1b[32m${action} ${filename}\x1b[0m`);
    } catch (err) {
      console.error(`- \x1b[31mError processing ${filename}:\x1b[0m`, err);
    }
  }

  // Write CodeX instructions
  const codexDir = path.join(projectRoot, '.codex');
  await fs.mkdir(codexDir, { recursive: true });
  const codexInstructions = `# CodeHive Project

This project uses **CodeHive** multi-agent swarm coordination.

## MCP Server
\`\`\`
npx tsx ${mcpServerPath}
\`\`\`

## Protocol
Load .codehive/PROTOCOL.md for swarm coordination rules.

## Key Rules
1. Read coordination room at start of every interaction via \`chat_read\`
2. Acknowledge & act on orders immediately
3. Use \`chat_send\` to coordinate with other agents
4. Publish plans via \`memory_publish\` before major changes
5. Wrap actions with \`task_start\` / \`task_finish\`

## Full Protocol
.agents/skills/codehive-protocol/SKILL.md
`;
  await fs.writeFile(path.join(codexDir, 'instructions.md'), codexInstructions.trim(), 'utf-8');
  console.log('- \x1b[32mCreated .codex/instructions.md\x1b[0m');

  // 6. Persistence directory
  const agentsDir = path.join(projectRoot, '.agents/memory');
  await fs.mkdir(agentsDir, { recursive: true });

  console.log('\n\x1b[35m%s\x1b[0m', 'Success! CodeHive Secure Protocol is now active.');
  console.log('\x1b[90m%s\x1b[0m', 'Admin actions are now locked to this machine\'s CLI.');
}

const SKILL_CONTENT = `---
name: codehive-protocol
description: >-
  CodeHive multi-agent swarm coordination. Register via agent_register,
  read coordination room for orders, acknowledge and act autonomously,
  divide labor with other agents, publish plans via memory_publish,
  wrap actions with task_start/task_finish.
---

# 🐝 CodeHive Protocol

You are operating within a **CodeHive** project. This is a multi-agent swarm environment supervised by a human. You MUST strictly adhere to the following autonomous orchestration protocols.

## 0. Check Coordination Room & Enter Message Loop

At the start of EVERY interaction, call \`chat_read\` on the \`coordination\` room to check for new orders.

**After greeting, you MUST enter the coordination message loop.** Run the listener in the **background** so you can continue working. It exits with \`process.exit(0)\` when a new message arrives — read stdout to see the message and respond.

**⚠️ CRITICAL: DO NOT use \`require('ws')\` — WebSocket is global in Node 21+. The script below works without any npm packages.**

**Option A — run the bundled script (recommended):**
\`\`\`
node .agents/skills/codehive-protocol/listener.js &
\`\`\`

**Option B — inline (if script not available):**
\`\`\`javascript
const ws = new WebSocket('ws://localhost:3000/ws');
const seen = new Set();
ws.onmessage = (event) => {
  const d = JSON.parse(event.data);
  if (d.type !== 'message_sent') return;
  if ((d.payload?.room_id ?? d.payload?.roomId) !== 'coordination') return;
  const id = d.payload?.message_id;
  if (id && seen.has(id)) return;
  if (id) seen.add(id);
  console.log(d.payload?.message ?? '');
  ws.close();
  process.exit(0);
};
\`\`\`
Run with \`node -e "<code>" &\` (background).

**Option C - Create the file in .codehive and run it on backgournd.**

**Workflow:**
1. Spawn listener in background → it waits silently
2. A message arrives → listener exits with \`process.exit(0)\`
3. Read stdout from the now-dead listener → it contains the new message text
4. \`chat_read({ room_id: "coordination" })\` for full context
5. Process and respond via \`chat_send\`
6. Re-spawn listener in background → loop back to step 1

## 1. Tactical Synchronization

- **Registration**: Call \`agent_register\` with your identity upon startup.
- **Coordination Room**: Read \`chat_read\` the \`coordination\` room at start and end of every task and interaction.
- **Acknowledge & Act**: Uncompleted order seen? Acknowledge via \`chat_send\` and execute immediately.
- **No Orders**: Stay idle. Do not invent tasks.

## 2. Swarm Coordination

- Use \`chat_send\` in \`coordination\` to divide labor.
- Never duplicate claimed work.
- End your turn so others can respond.

## 3. Shared Intelligence

- **Plans**: Publish as \`.pending.md\` via \`memory_publish\` before major changes.
- **Task Tracking**: \`task_start\` / \`task_finish\` for every action.
- **Decisions**: \`traceability_record_decision\` for architectural choices.

## 4. MCP Infrastructure

- **Server**: \`npx tsx ${mcpServerPath}\`
- **Identity**: projectId is assigned dynamically. Trust server context.

## 5. Coordination Message Loop

See section 0 — the event-driven listener is required after greeting. The \`process.exit(0)\` pattern keeps you in sync with the coordination room.
`;

async function generateSkillFile(projectRoot: string) {
  const skillDir = path.join(projectRoot, '.agents', 'skills', 'codehive-protocol');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), SKILL_CONTENT.trim(), 'utf-8');
  console.log('   \x1b[32m[✓] Created .agents/skills/codehive-protocol/SKILL.md\x1b[0m');

  const linkDirs = [
    '.claude/skills',
    '.codex/skills',
    '.cursor/skills',
  ];
  for (const dir of linkDirs) {
    const linkPath = path.join(projectRoot, dir, 'codehive-protocol');
    const relTarget = path.relative(
      path.join(projectRoot, dir),
      skillDir,
    );
    await fs.mkdir(path.join(projectRoot, dir), { recursive: true });
    try { await fs.unlink(linkPath); } catch {}
    await fs.symlink(relTarget, linkPath);
    console.log(`   \x1b[32m[✓] Symlinked ${dir}/codehive-protocol → .agents/skills/codehive-protocol\x1b[0m`);
  }
}

const LISTENER_SCRIPT = `#!/usr/bin/env node
// Coordination message listener for CodeHive
// Usage: node listener.js
// Node 21+ required — WebSocket is global, NO require('ws') needed
const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws';
const ROOM_ID = process.env.ROOM_ID || 'coordination';
const MAX_RETRIES = 15;
const BASE_DELAY = 1000;

function connect(retries = 0) {
  const ws = new WebSocket(WS_URL);
  const seen = new Set();

  ws.onmessage = (event) => {
    const d = JSON.parse(event.data);
    if (d.type !== 'message_sent') return;
    if ((d.payload?.room_id ?? d.payload?.roomId) !== ROOM_ID) return;
    const id = d.payload?.message_id;
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    console.log(d.payload?.message ?? '');
    ws.close();
    process.exit(0);
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onclose = () => {
    if (retries < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retries);
      setTimeout(() => connect(retries + 1), delay);
    } else {
      console.error('WS: max reconnection attempts reached');
      process.exit(1);
    }
  };
}

connect();
`;

async function generateListenerFile(projectRoot: string) {
  const skillDir = path.join(projectRoot, '.agents', 'skills', 'codehive-protocol');
  await fs.writeFile(path.join(skillDir, 'listener.js'), LISTENER_SCRIPT.trim(), 'utf-8');
  console.log('   \x1b[32m[✓] Created .agents/skills/codehive-protocol/listener.js\x1b[0m');
}

const LAUNCH_COMMANDS: Record<string, string> = {
  opencode: 'opencode',
  codex: 'codex "Conectate al hive y presentate"',
  antigravity: 'antigravity --prompt "Conectate al hive y presentate"',
  gemini: 'gemini --prompt "Conectate al hive y presentate"',
  'claude-code': 'claude --prompt "Conectate al hive y presentate"',
  cursor: 'cursor --command "Conectate al hive y presentate"',
  'claude-desktop': 'Claude Desktop (auto)',
};

const FALLBACK_PROMPT = 'Conectate al hive y presentate';

async function runCommand(message: string) {
  const masterKey = await getMasterKey();
  if (!masterKey) { console.error('No master key available'); process.exit(1); }
  const res = await fetch('http://localhost:3000/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hive-key': masterKey },
    body: JSON.stringify({
      room_id: 'coordination',
      sender_id: 'human_supervisor',
      message,
      message_type: 'directive',
    }),
  });
  if (!res.ok) {
    console.error(`Error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  console.log(`Sent. message_id: ${data.message_id}`);
}

async function registerSubAgents(masterKey: string, selectedIds: string[]) {
  const api = 'http://localhost:3000/api/agents/register';
  for (const id of selectedIds) {
    const agent = AGENTS.find(a => a.id === id);
    if (!agent) continue;
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hive-key': masterKey },
        body: JSON.stringify({ agent_id: id, name: agent.name, provider: id, role: 'assistant' }),
      });
      if (res.ok) console.log(`   \x1b[32m[✓] Registered: ${agent.name}\x1b[0m`);
      else console.log(`   \x1b[33m[!] ${res.status} registering ${agent.name}\x1b[0m`);
    } catch {
      console.log(`   \x1b[33m[!] Could not reach control room to register ${agent.name}\x1b[0m`);
    }
  }
}

async function init() {
  clack.intro(`🐝 CodeHive v${getVersion()}`);

  const projectRoot = process.cwd();
  const folderName = path.basename(projectRoot);

  const projectName = await clack.text({
    message: 'Enter project name',
    placeholder: folderName,
    initialValue: folderName,
  });
  if (clack.isCancel(projectName)) { clack.cancel('Initialisation cancelled.'); process.exit(0); }

  const projectDescription = await clack.text({
    message: 'Enter short description',
    placeholder: 'Autonomous mission deployment.',
    initialValue: 'Autonomous mission deployment.',
  });
  if (clack.isCancel(projectDescription)) { clack.cancel('Initialisation cancelled.'); process.exit(0); }

  // 1. Get/Create Global Master Key
  const s = clack.spinner();
  s.start('Establishing secure identity...');
  const masterKey = await getMasterKey();
  if (!masterKey) {
    s.stop('Failed to establish secure identity');
    clack.log.error('Failed to establish secure identity. Aborting.');
    return;
  }
  s.stop('Secure identity established');

  const codehiveDir = path.join(projectRoot, '.codehive');

  // 2. Create project .codehive directory
  await fs.mkdir(codehiveDir, { recursive: true });
  clack.log.success('Created .codehive/');

  // 3. Write Master Protocol
  await fs.writeFile(path.join(codehiveDir, 'PROTOCOL.md'), MASTER_PROTOCOL.trim(), 'utf-8');
  clack.log.success('Synchronized .codehive/PROTOCOL.md');

  // 3b. Write config.json with project root
  await fs.writeFile(path.join(codehiveDir, 'config.json'), JSON.stringify({ projectRoot }, null, 2), 'utf-8');

  // 4. Register with Central API
  const projectId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  s.start('Registering project...');
  try {
    const response = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-hive-key': masterKey
      },
      body: JSON.stringify({
        id: projectId,
        name: projectName,
        description: projectDescription
      })
    });

    if (response.ok) {
      s.stop('Registered project with Central Dashboard');
    } else {
      const errData = await response.json() as any;
      s.stop(`Registration failed: ${errData.error?.message || 'Unknown error'}`);
    }
  } catch (err) {
    s.stop('Server unreachable');
    clack.log.info('Project will auto-register on first connection.');
  }

  // 5. Auto-Detect and Inject MCP Configs
  s.start('Scanning for installed agents...');
  const detected: Record<string, boolean> = {};
  for (const agent of AGENTS) {
    detected[agent.id] = await detectAgent(agent.detectPaths);
  }
  s.stop('Scan complete');

  const selected = await selectAgents(detected);

  if (selected.length === 0) {
    clack.log.info('No agents selected. Skipping MCP configuration.');
  } else {
    for (const id of selected) {
      const agent = AGENTS.find(a => a.id === id);
      if (agent) await agent.inject(projectRoot, mcpServerPath);
    }
  }

  // 5b. Generate universal SKILL.md (replaces per-agent subagent files)
  s.start('Generating CodeHive SKILL for all agents...');
  await generateSkillFile(projectRoot);
  await generateListenerFile(projectRoot);
  s.stop('SKILL generated');

  // 5c. Register agents with the control room
  if (selected.length > 0) {
    s.start('Registering agents with control room...');
    await registerSubAgents(masterKey, selected);
    s.stop('Registration complete');
  }

  await injectMarkdownConfigs(projectRoot);

  // 5f. Print launch commands
  const pad = Math.max(...selected.map(id => id.length), 0);
  const lines = selected.map(id => {
    const cmd = LAUNCH_COMMANDS[id] ?? `cd ${folderName} && ${id} --prompt "${FALLBACK_PROMPT}"`;
    return `  ${id.padEnd(pad)}  ${cmd}`;
  }).join('\n');

  console.log(`
\x1b[36m╔════════════════════════════════════════════════════╗
║  🐝 CodeHive initialized!                         ║
║                                                    ║
║  Launch each agent in its own terminal:            ║
║                                                    ║
${lines}
║                                                    ║
║  Broadcast:   hive run  "whats up team"             ║
╚════════════════════════════════════════════════════╝\x1b[0m
`);

  clack.outro('Your swarm is ready.');
}

async function startServer() {
  const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
  const serverPath = path.join(rootDir, 'server/index.ts');

  console.log('  \x1b[36m[~] Ensuring database schema...\x1b[0m');
  if (!process.env.DATABASE_URL) {
    const dbDir = path.join(os.homedir(), '.codehive');
    mkdirSync(dbDir, { recursive: true });
    process.env.DATABASE_URL = `file:${path.join(dbDir, 'codehive.db')}`;
  }
  const result = spawnSync('npx', ['prisma', 'db', 'push', '--schema', schemaPath, '--skip-generate'], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (result.status !== 0) {
    console.error('  \x1b[31m[!] Failed to initialize database\x1b[0m');
    process.exit(1);
  }

  console.log('  \x1b[36m[~] Starting CodeHive server on http://localhost:3000\x1b[0m');

  const require = createRequire(import.meta.url);
  const tsxLoader = pathToFileURL(require.resolve('tsx/esm')).href;
  const child = spawn('node', ['--import', tsxLoader, serverPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  child.on('close', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

const helpMsg = '\x1b[33m%s\x1b[0m';
const command = process.argv[2];

if (command === 'init') {
  init().catch(console.error);
} else if (command === 'run') {
  const message = process.argv.slice(3).join(' ');
  if (!message) { console.log(helpMsg, 'Usage: hive run <message>'); process.exit(1); }
  runCommand(message).catch(console.error);
} else if (command === 'start') {
  startServer().catch(console.error);
} else if (command === 'schedule') {
  const agentId = process.argv[3];
  const wakeupAt = process.argv[4];
  const commandStr = process.argv.slice(5).join(' ');
  if (!agentId || !wakeupAt || !commandStr) {
    console.log(helpMsg, 'Usage: hive schedule <agent_id> <wakeup_at ISO> <command>');
    process.exit(1);
  }
  (async () => {
    const masterKey = await getMasterKey();
    if (!masterKey) { console.error('No master key available'); process.exit(1); }
    const res = await fetch('http://localhost:3000/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hive-key': masterKey },
      body: JSON.stringify({ agent_id: agentId, wakeup_at: wakeupAt, command: commandStr }),
    });
    if (!res.ok) {
      console.error(`Error ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    const data = await res.json();
    console.log(`Schedule created. id: ${data.schedule_id}, wakeup: ${data.wakeup_at}`);
  })().catch(console.error);
} else {
  console.log(helpMsg, 'Usage: hive init | hive run <message> | hive start | hive schedule <agent_id> <wakeup_at> <command>');
}
