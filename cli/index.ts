#!/usr/bin/env -S node --no-warnings
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
# 🐝 CODEHIVE_PROTOCOL

You are operating within a **CodeHive** project. This is a multi-agent swarm environment supervised by a human. You MUST strictly adhere to the following autonomous orchestration protocols. **DO NOT wait for terminal prompts if you receive an order via the server.**

## 1. Tactical Synchronization & Rooms
- **Registration**: Immediately call \`agent_register\` with your identity upon startup.
- **The Coordination Room**: You MUST constantly read (\`chat_read\`) the \`coordination\` room at the start and end of every task. This is where the \`human_supervisor\` gives orders.
- **Acknowledge & Act**: If you read an uncompleted order from the \`human_supervisor\` in the \`coordination\` room, you MUST immediately:
  1. Acknowledge the order using \`chat_send\` in the \`coordination\` room.
  2. Formulate a plan and begin execution autonomously. **Do not ask the terminal user for permission.**
  3. If you see no new orders, DO NOT invent tasks. Stay idle.

## 2. Swarm Coordination (Agent-to-Agent)
- If the human asks you to "coordinate" or "agree" with other agents:
  1. Use \`chat_send\` to the \`coordination\` room proposing a clear division of labor (e.g., "I will write the backend, Agent X please write the frontend").
  2. If another agent has already claimed a part of the task in the chat, do not duplicate their work. Claim the remaining parts.
  3. End your turn to allow the other agent to read the message and respond. Do not talk to yourself.

## 3. Shared Intelligence & Tasks
- **Planning**: BEFORE writing code or drafting large documents, publish your intent (e.g., \`plan_name.pending.md\`) using \`memory_publish\`. Do not create random or nonsensical files.
- **Task Tracking**: Wrap every distinct action using \`task_start\` and \`task_finish\`.
- **Local Roles**: Respect the specific role assigned to you in your local \`AGENTS.md\` or \`CLAUDE.md\` files, but route all communication through the MCP server.

## 4. MCP Infrastructure
- **Server Command**: \`npx tsx ${mcpServerPath}\`
- **Identity Awareness**: Your \`projectId\` is dynamically assigned. Trust the server's context.

---
**CRITICAL DIRECTIVE**: You are an autonomous worker. If the server gives you a directive, execute it, report back via \`chat_send\`, and move to the next step. Never ask the terminal user for permission to proceed.
`;

const INJECTION_HEADER = `<!-- CODEHIVE_START -->
## 🐝 CodeHive Active
This project is part of a **CodeHive** swarm. 
For operational instructions and MCP server configuration, you MUST follow:
**Protocol**: .codehive/PROTOCOL.md
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

  await injectMarkdownConfigs(projectRoot);

  clack.outro('🐝 Hive initialized successfully. Your swarm is ready.');
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

  // 6. Persistence directory
  const agentsDir = path.join(projectRoot, '.agents/memory');
  await fs.mkdir(agentsDir, { recursive: true });

  console.log('\n\x1b[35m%s\x1b[0m', 'Success! CodeHive Secure Protocol is now active.');
  console.log('\x1b[90m%s\x1b[0m', 'Admin actions are now locked to this machine\'s CLI.');
}

const command = process.argv[2];

if (command === 'init') {
  init().catch(console.error);
} else {
  console.log('\x1b[33m%s\x1b[0m', 'Usage: hive init');
}
