#!/usr/bin/env -S node --no-warnings
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mcpServerPath = path.join(rootDir, 'mcp/server.ts');

const MASTER_PROTOCOL = `
# 🐝 CODEHIVE_PROTOCOL

You are operating within a **CodeHive** project. This project is managed by a central Command & Control server. You MUST adhere to the following autonomous orchestration protocols:

## 1. Tactical Synchronization
- **Registration**: Immediately call \`agent.register\` with your identity. If you are part of a sub-task, provide the \`parent_agent_id\`.
- **Status Greet**: Send a "Ready" or "Online" message to the \`coordination\` room via \`chat.send\`.
- **Listening**: Periodically check \`chat.read\` for orders from the Human Supervisor or Coordinator agents.

## 2. Shared Intelligence (Shared Memory)
- **Planning**: BEFORE any significant code change, publish your intent as a plan (e.g., \`plan_name.pending.md\`) using \`memory.publish\`.
- **Verification**: Use \`memory.list\` and \`memory.read\` to check for Image, PDF, or Markdown context uploaded by the Human.

## 3. Operations
- **Task Tracking**: Use \`task.start\` and \`task.finish\` for every discrete work unit. Link sub-tasks via \`parent_task_id\`.
- **Decision Log**: Record critical architectural or logic changes using \`traceability.record_decision\`.

## 4. MCP Infrastructure
- **Server Command**: \`npx tsx ${mcpServerPath}\`
- **Identity Awareness**: The \`projectId\` is automatically detected from your CWD.

---
**SECURITY NOTICE**: Never attempt to read or modify files within \`.codehive/\` except for \`PROTOCOL.md\`.
`;

const INJECTION_HEADER = `<!-- CODEHIVE_START -->
## 🐝 CodeHive Active
This project is part of a **CodeHive** swarm. 
For operational instructions and MCP server configuration, you MUST follow:
**Protocol**: .codehive/PROTOCOL.md
<!-- CODEHIVE_END -->

`;

async function init() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\x1b[33m%s\x1b[0m', '🐝 Initializing CodeHive (Secure Mode)...');
  
  const projectRoot = process.cwd();
  const folderName = path.basename(projectRoot);

  const projectName = await rl.question(`\x1b[36mEnter project name\x1b[0m (default: ${folderName}): `) || folderName;
  const projectDescription = await rl.question(`\x1b[36mEnter short description\x1b[0m: `) || 'Autonomous mission deployment.';

  rl.close();

  const codehiveDir = path.join(projectRoot, '.codehive');

  // 1. Create .codehive directory
  await fs.mkdir(codehiveDir, { recursive: true });

  // 2. Handle API Key (Project-local, private from agents)
  let apiKey = '';
  const keyPath = path.join(codehiveDir, 'api.key');
  try {
    apiKey = await fs.readFile(keyPath, 'utf-8');
    console.log('- \x1b[32mExisting API key loaded.\x1b[0m');
  } catch (e) {
    apiKey = crypto.randomBytes(24).toString('hex');
    await fs.writeFile(keyPath, apiKey, 'utf-8');
    // Set permissions to be readable only by owner if on linux
    try { await fs.chmod(keyPath, 0o600); } catch (e) {}
    console.log('- \x1b[32mGenerated secure project-local API key.\x1b[0m');
  }

  // 3. Write Master Protocol
  await fs.writeFile(path.join(codehiveDir, 'PROTOCOL.md'), MASTER_PROTOCOL.trim(), 'utf-8');
  console.log('- \x1b[32mSynchronized .codehive/PROTOCOL.md\x1b[0m');

  // 4. Register with Central API
  const projectId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  try {
    const response = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-hive-key': apiKey.trim()
      },
      body: JSON.stringify({
        id: projectId,
        name: projectName,
        description: projectDescription
      })
    });

    if (response.ok) {
      console.log('- \x1b[32mRegistered project with Central Dashboard.\x1b[0m');
    } else {
      const errData = await response.json() as any;
      console.log(`- \x1b[31mRegistration failed: ${errData.error?.message || 'Unknown error'}\x1b[0m`);
    }
  } catch (err) {
    console.log('- \x1b[33mServer unreachable. Project will auto-register on first connection.\x1b[0m');
  }

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
