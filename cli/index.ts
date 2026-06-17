#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// We assume this script is located at <CONTROL_ROOM_ROOT>/cli/index.ts (or .js after build)
const rootDir = path.resolve(__dirname, '..');
const mcpServerPath = path.join(rootDir, 'mcp/server.ts');

const ACTIVATION_PROTOCOL = `
## CodeHive Activation 🐝

You have access to a shared CodeHive Control Room via MCP. You MUST follow these protocols for coordination:

1. **Self-Registration**: Call \`agent.register\` immediately. If you are a sub-agent, you MUST provide your coordinator's ID in the \`parent_agent_id\` field.
2. **Greeting**: Send a message to the 'coordination' room with \`chat.send\`.
3. **Transparent Planning**: Publish your execution plan to the shared knowledge base using \`memory.publish\` BEFORE making major changes.
4. **Active Listening**: Periodically check \`chat.read\` for human supervisor feedback or orders from your coordinator.

**MCP Server Execution Command:**
\`npx tsx ${mcpServerPath}\`
`;

async function init() {
  console.log('\x1b[33m%s\x1b[0m', '🐝 Initializing CodeHive in this project...');
  
  const filesToUpdate = ['AGENTS.md', 'GEMINI.md', '.cursorrules', '.clinerules'];
  const projectRoot = process.cwd();

  for (const filename of filesToUpdate) {
    const filePath = path.join(projectRoot, filename);
    try {
      let content = '';
      let exists = false;
      try {
        content = await fs.readFile(filePath, 'utf-8');
        exists = true;
        if (content.includes('CodeHive Activation')) {
          console.log(`- \x1b[33m${filename}\x1b[0m already has activation protocol. Skipping.`);
          continue;
        }
      } catch (e) {
        // File doesn't exist, we'll create it if it's AGENTS.md or GEMINI.md
        if (filename === '.cursorrules' || filename === '.clinerules') continue;
      }

      const newContent = exists ? `${content}\n${ACTIVATION_PROTOCOL}` : `# Project Instructions\n${ACTIVATION_PROTOCOL}`;
      await fs.writeFile(filePath, newContent, 'utf-8');
      console.log(`- \x1b[32mUpdated ${filename}\x1b[0m`);
    } catch (err) {
      console.error(`- \x1b[31mError updating ${filename}:\x1b[0m`, err);
    }
  }

  // Create .agents directory for local project persistence if not exists
  const agentsDir = path.join(projectRoot, '.agents/memory');
  await fs.mkdir(agentsDir, { recursive: true });
  console.log('- \x1b[32mCreated .agents/memory directory.\x1b[0m');

  console.log('\n\x1b[35m%s\x1b[0m', 'Success! Your project is now part of the CodeHive.');
}

const command = process.argv[2];

if (command === 'init') {
  init().catch(console.error);
} else {
  console.log('\x1b[33m%s\x1b[0m', 'Usage: hive init');
}
