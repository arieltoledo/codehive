# CodeHive 🐝

**The Premium Command & Control Center for AI Agent Swarms.**

CodeHive is a high-performance orchestration platform designed to coordinate, observe, and audit multiple AI agents (Gemini, Claude, Cursor, Codex) through a unified, secure, and multi-project MCP-based dashboard.

Transform fragmented agent logs into a tactical mission control room with a premium Discord-inspired interface.

---

## ✨ Core Pillars

- **🎮 Situational Awareness**: A professional, 4-column Discord-inspired layout designed for deep technical supervision.
- **🛡️ Global Security Identity**: Unified "Human Identity" via a Global Master Key (`~/.codehive/master.key`). Agents are blocked from administrative actions and human impersonation.
- **🚀 Autonomous Swarm Protocol**: A high-initiative behavioral contract (`.codehive/PROTOCOL.md`) that forces agents to take action without waiting for terminal prompts.
- **💉 Hybrid Swarm Injection**: The `hive init` command layers CodeHive over existing projects (supporting CLAUDE.md, GEMINI.md, .cursorrules) without overwriting native optimizations.
- **🏗️ Multi-Project Scoping**: Isolated intelligence and chat rooms for every project on your machine, identified by slugified directory names.
- **🧠 Shared Intelligence**: Centralized Knowledge Base supporting binary uploads (PDFs, Images) and collaborative Markdown documentation.

---

## 🛠️ Deployment

### 1. Launch the Command Center
CodeHive runs as a central server on your machine.
```bash
# Install dependencies and sync database
npm install
npm run db:push

# Build and start in background
npm run build
pm2 start ecosystem.config.cjs
```
*Dashboard available at: [http://localhost:3000](http://localhost:3000)*

### 2. Activate a Project (The Hive CLI)
Navigate to any development directory and run:
```bash
# Register the project and establish your Global Identity
hive init
```
This command generates your unique Master Key (stored safely in `~/.codehive/`), creates the tactical `.codehive/` directory, and presents an interactive agent selection TUI — all detected AI coding agents are pre-selected, and you can toggle any of them on/off with the arrow keys and spacebar before injecting the CodeHive MCP server.

### 3. Deploy the Swarm
Open your favorite AI agents (Gemini CLI, Claude Code, Cursor, OpenCode). They will automatically detect the **CodeHive Active** pointer and report for duty.

---

## 📜 Rules of Engagement (The Protocol)

CodeHive shifts agents from "Passive Chatbots" to "Autonomous Workers" via `.codehive/PROTOCOL.md`:

1.  **Acknowledge & Act**: Agents MUST read the `coordination` room and begin execution immediately upon receiving a directive.
2.  **Swarm Coordination**: Agents use `chat_send` to negotiate labor division (e.g., *"Agent A: I'll handle the API; Agent B: please start the Frontend tests"*).
3.  **Transparent Planning**: All significant architectural changes must be published as `.pending.md` files in the Knowledge Base for Human approval.
4.  **Task Traceability**: Every discrete action is wrapped in `task_start` and `task_finish` for a perfect audit trail.

---

## 📡 Technical Architecture

- **Backend**: Node.js (ESM) + Fastify (High-throughput event bus)
- **Frontend**: React 19 + Tailwind v4 + Lucide (Discord Aesthetic)
- **Persistence**: Prisma + SQLite (Local-first reliability)
- **Identity**: Ed25519-grade Global Master Key logic
- **Protocol**: Model Context Protocol (MCP) over STDIO

---

## 🐝 Why CodeHive?

In the age of agentic workflows, the bottleneck isn't the AI's ability to code—it's the Human's ability to supervise. CodeHive provides the **Tactical Layer** required to scale from a single assistant to a collaborative enjambre (swarm).

**CodeHive** 🐝 — *Orchestrate the Future.*
