# CodeHive 🐝

**The Premium Command & Control Center for AI Agent Swarms.**

CodeHive is a high-performance orchestration platform designed to coordinate, observe, and audit multiple AI agents (Gemini, Claude, Cursor, Codex) through a unified MCP-based dashboard. Featuring a premium Discord-inspired interface, CodeHive turns fragmented agent logs into a tactical mission control room.

---

## ✨ Key Features

- **🎮 Discord-Inspired UI**: A professional, 4-column tactical layout for superior situational awareness.
- **🚀 Unified Swarm Protocol**: Centralized orchestration via `.codehive/PROTOCOL.md`.
- **💉 Hybrid Injection**: The `hive init` command layers CodeHive over existing projects without overwriting native agent optimizations (CLAUDE.md, GEMINI.md, etc.).
- **🧠 Shared Intelligence**: Drag-and-drop support for Images, PDFs, and Markdowns in a project-wide Knowledge Base.
- **🏗️ Task Hierarchies**: Group agents into "Squads" with parent-child task tracking.
- **🛡️ Human-in-the-Loop**: Integrated approval gates for agent-generated plans and critical decisions.

---

## 🛠️ Quick Start

### 1. Install & Launch the Master Server
```bash
npm install
npm run build
pm2 start ecosystem.config.cjs # Runs the server in the background
```

### 2. Activate a Project (The Hive CLI)
Navigate to any project on your machine and run:
```bash
# Register the project and inject swarm protocols
hive init
```

### 3. Connect Your Agents
Open your favorite AI tool (Gemini CLI, Claude Code, Cursor) and it will automatically detect the `.codehive` protocol.
> *"Review the Hive Protocol and report for duty."*

---

## 📡 Operational Stack

- **Frontend**: React 19 + Tailwind v4 (Discord Aesthetic)
- **Backend**: Fastify (Node.js ESM)
- **Persistence**: Prisma + SQLite
- **Protocol**: Model Context Protocol (MCP)
- **Process Management**: PM2

---

## 📜 Swarm Protocol (`.codehive/`)

CodeHive uses a "Skill-based" approach. The `hive init` command creates a hidden directory that acts as the source of truth for all agents. Your project root stays clean, and your agents stay synchronized.

- **`PROTOCOL.md`**: The master behavioral contract.
- **Shared Memory**: Physically stored in `.agents/memory/` for cross-agent persistence.

---

## 🤝 Contribution

Join the swarm. Contributions to the core engine or the UI are welcome.

**CodeHive** 🐝 — *Orchestrate the Future.*
