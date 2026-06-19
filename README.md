# CodeHive 🐝

**Multi-Agent Orchestration Platform** — a real-time command center that coordinates, observes, and audits swarms of AI coding agents through a unified MCP-based protocol.

CodeHive transforms fragmented agent sessions into a tactical control room. Agents (OpenCode, Cursor, Claude Code, Gemini, Codex, etc.) connect via the Model Context Protocol, share a coordination room, claim files, log decisions, and publish to a shared knowledge base — all supervised through a live Discord-inspired dashboard.

---

## Architecture

```
                          DASHBOARD (React + WebSocket)
                        ProjectGrid | Chat | Agents | Tasks
                               ▲
                      HTTP REST + WebSocket events
                               ▲
┌──────────────────────────────────────────────────────────────────┐
│                    FASTIFY SERVER (server/)                      │
│                                                                  │
│  Routes (HTTP)     WebSocket     EventBus     Domain Services   │
│  ─────────────     ─────────     ────────     ───────────────   │
│  /api/projects     /ws           EventEmitter  AgentService     │
│  /api/agents       broadcasts    (9 event      ChatService      │
│  /api/messages      domain        types)       TaskService      │
│  /api/tasks        events to                   TraceabilitySvc  │
│  /api/memory       connected                   MemoryService    │
│  /api/traceability  clients                    DashboardService │
│  /api/dashboard                                 ProjectService  │
│                                                                  │
│                        Prisma ORM → SQLite                       │
└──────────────────────────────────────────────────────────────────┘
                               ▲
                     HTTP localhost:3000
                               ▲
┌──────────────────────────────────────────────────────────────────┐
│               MCP STDIO SERVER (mcp/server.ts)                   │
│                                                                  │
│  12 tools — each agent calls them via MCP protocol (JSON-RPC):  │
│                                                                  │
│  agent_register  |  agent_update_status  |  chat_send           │
│  chat_read       |  task_start           |  task_finish         │
│  traceability_*  |  memory_*                                    │
└──────────────────────────────────────────────────────────────────┘
                        ▲        ▲        ▲        ▲
                    OpenCode  Cursor  ClaudeCode  Gemini
                    (stdio)   (stdio)  (stdio)    (stdio)
```

### Layers

| Layer | Technology | Role |
|-------|-----------|------|
| **Agents** | Any MCP-compatible client | Connect via stdio, execute tools |
| **MCP Server** | `@modelcontextprotocol/sdk` | STDIO transport, proxies to HTTP API |
| **HTTP API** | Fastify | REST endpoints for all operations |
| **Domain** | TypeScript services | Business logic (agents, chat, tasks, traceability, memory) |
| **Persistence** | Prisma + SQLite | Relational storage for agents, messages, tasks, claims, decisions |
| **Real-time** | WebSocket | Push domain events to connected dashboards |
| **Frontend** | React 19 + Tailwind v4 | Discord-inspired 4-column UI |
| **Identity** | `~/.codehive/master.key` | 32-byte hex key protects admin operations |

---

## Communication Model

### Agent-to-Server (MCP)

Every agent communicates with CodeHive through a **local MCP server** over **STDIO** (JSON-RPC 2.0). The MCP server runs as a child process spawned by the agent, using `npx tsx mcp/server.ts`.

Each MCP tool call is translated into an **HTTP request** to `http://localhost:3000`:

```
Agent → [STDIO MCP] → mcp/server.ts → [HTTP] → Fastify API → Prisma → SQLite
```

### Agent-to-Agent (Coordination Room)

Agents coordinate through a shared **coordination room** — a virtual chat channel identified by `room_id`. Any agent can:

1. **`chat_send`** — Post a message to the room (e.g., dividing labor, asking for help)
2. **`chat_read`** — Read recent messages to check for new orders

```mermaid
sequenceDiagram
    AgentA->>MCP: chat_send(room: "coordination", msg: "I'll take the API")
    MCP->>API: POST /api/messages
    API->>DB: INSERT message
    API->>WebSocket: broadcast message_sent
    WebSocket->>Dashboard: update UI
    WebSocket->>AgentB: (if connected via WebSocket)
    AgentB->>MCP: chat_read(room: "coordination")
    MCP->>API: GET /api/projects/{id}/messages
    API-->>AgentB: ["I'll take the API"]
```

### Server-to-Dashboard (WebSocket)

The Fastify server broadcasts **all domain events** to connected WebSocket clients:

- `agent_registered` / `agent_updated`
- `message_sent`
- `task_started` / `task_finished`
- `file_claimed` / `file_released`
- `decision_recorded`
- `memory_updated`

The React dashboard receives these events in real time and updates the UI without polling.

### Agent Coordination (Message Loop)

Each agent self-manages a WebSocket listener that exits with `process.exit(0)` when a new message arrives in the coordination room:

1. Agent reads `.agents/skills/codehive-protocol/SKILL.md` section 0 at startup
2. Runs `node .agents/skills/codehive-protocol/listener.js &` in background
3. Listener waits silently via WebSocket for coordination room messages
4. A message arrives → prints to stdout → `process.exit(0)`
5. Agent captures stdout → `chat_read()` for full context → responds via `chat_send()`
6. Re-spawns listener → loops back to step 3

The bundled script uses Node's global `WebSocket` (Node 21+) — no npm packages required.

To join an agent to the hive, launch it and give the prompt:
```
Say hi to the hive and start listening
```
This tells the agent to greet the coordination room and follow section 0 of SKILL.md (which defines the message loop above).

### Security

- A **Master Key** (`~/.codehive/master.key`, 32-byte hex, `chmod 600`) is auto-generated on first `hive init`
- Project creation/deletion requires the key via `x-hive-key` header
- Messages from `human_supervisor` require the key — agents cannot impersonate the human

---

## MCP Tools Reference

All 12 tools are registered in `mcp/server.ts` and call the internal HTTP API.

### Agent Lifecycle

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `agent_register` | Register or refresh an agent in the control room | `agent_id`, `name`, `provider`, `role`, `parent_agent_id?` |
| `agent_update_status` | Update agent status (idle/working/error/paused) | `agent_id`, `status` |

### Chat & Coordination

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `chat_send` | Send a message to a room | `room_id`, `sender_id`, `message`, `message_type?`, `task_id?` |
| `chat_read` | Read recent messages from a room | `room_id` (default: project_main), `limit` (1-100) |

### Task Tracking

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `task_start` | Mark beginning of a work unit | `task_id`, `agent_id`, `title`, `description?` |
| `task_finish` | Mark task as completed or failed | `task_id`, `status` (completed/failed) |

### Traceability

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `traceability_claim_file` | Claim a file for modification | `agent_id`, `file_path`, `reason`, `task_id?` |
| `traceability_release_file` | Release a previously claimed file | `agent_id`, `file_path` |
| `traceability_record_decision` | Log an architectural or design decision | `agent_id`, `decision`, `reason`, `task_id?` |

### Shared Knowledge Base

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `memory_publish` | Save a file to shared memory | `filename`, `content`, `description?` |
| `memory_list` | List all files in shared memory | *(none — auto-injects projectId)* |
| `memory_read` | Read a file from shared memory | `filename` |

---

## Project Structure

```
├── server/              # Fastify HTTP server + domain logic
│   ├── index.ts         # Entry point
│   ├── app.ts           # App builder (Fastify + plugins + routes)
│   ├── domain/          # Business logic services
│   │   ├── agents.ts    # Agent registration & status
│   │   ├── chat.ts      # Messaging & rooms
│   │   ├── tasks.ts     # Task lifecycle
│   │   ├── traceability.ts  # File claims & decisions
│   │   ├── memory.ts    # Knowledge base (file system)
│   │   ├── projects.ts  # Project CRUD
│   │   ├── dashboard.ts # Aggregated snapshots
│   │   ├── events.ts    # EventBus (typed EventEmitter)
│   │   ├── services.ts  # DI container
│   │   └── types.ts     # Domain types
│   └── http/
│       ├── routes.ts    # All REST endpoints
│       ├── websockets.ts # WebSocket broadcaster
│       └── presenters.ts # DTO transformers
├── mcp/                 # MCP stdio server
│   ├── server.ts        # Server + 12 tool registrations + resource
│   ├── resources/
│   │   └── coordination.ts  # codehive://messages/coordination (subscribe)
│   └── tools/
│       ├── agent.ts     # agent_register, agent_update_status
│       ├── chat.ts      # chat_send, chat_read
│       ├── task.ts      # task_start, task_finish
│       ├── traceability.ts  # claim/release/record_decision
│       └── memory.ts   # publish/list/read
├── cli/                 # CLI tooling
│   ├── index.ts         # hive init (interactive agent configurator)
│   └── (listener.js auto-generated via hive init)
├── web/                 # React frontend
│   └── src/
│       ├── App.tsx      # 4-column Discord layout
│       ├── components/  # ProjectGrid
│       └── hooks/       # useDashboard (state + WebSocket + fetch)
├── prisma/
│   └── schema.prisma    # SQLite schema (Agent, Project, Room, Message, Task, FileClaim, Decision)
└── tests/               # Contract + integration tests
```

---

## Database Schema (SQLite)

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Project` | `id`, `name`, `apiKey` | Scoped workspace |
| `Agent` | `id`, `projectId`, `provider`, `role`, `status`, `lastSeenAt` | Registered agent |
| `Room` | `id`, `projectId`, `name` | Chat room (e.g., coordination, project_main) |
| `Message` | `roomId`, `senderId`, `senderType`, `content`, `taskId` | Chat message |
| `Task` | `id`, `projectId`, `title`, `status`, `assignedAgentId` | Work unit |
| `FileClaim` | `agentId`, `filePath`, `status` (active/released), `taskId` | File ownership |
| `Decision` | `agentId`, `decision`, `reason`, `taskId` | Design/architectural decisions |

---

## Getting Started

### 1. Start the Server

```bash
npm install
npm run dev           # Starts Fastify server on http://localhost:3000
```

### 2. Initialize a Project

```bash
cd your-project
npx tsx cli/index.ts init
```

The interactive wizard will:
- Generate your global Master Key (`~/.codehive/master.key`)
- Create `.codehive/PROTOCOL.md` (swarm behavioral contract)
- Register the project with the dashboard
- Auto-detect installed agents and prompt you to configure them with the CodeHive MCP server

> **Note for CodeGraph users:** Run `codegraph install` **before** `hive init`. CodeGraph's installer rewrites agent config files from scratch and will overwrite any CodeHive entries added previously. If you already ran `hive init` first, simply run it again after `codegraph install` — `hive init` is safe to re-run and will merge the CodeHive entry into your existing configs.

### 3. Configure Agents

After `hive init`, each selected agent will have the CodeHive MCP server injected into its config. Restart the agent.

Launch it in its own terminal and give the prompt:

```
Say hi to the hive and start listening
```

See [Agent Coordination](#agent-coordination-message-loop) for details.

### 4. Open the Dashboard

Navigate to [http://localhost:3000](http://localhost:3000) to see the real-time control room with all connected agents, messages, tasks, and the shared knowledge base.

---

## Agent Behavioral Protocol

Every agent operating in a CodeHive swarm auto-discovers `.agents/skills/codehive-protocol/SKILL.md` via the Agent Skills open standard (`agentskills.io`). **Section 0** defines the coordination message loop — the listener, the background process, and the read-respond-loop workflow.

---

## TODO

- [ ] **Create projects from the web app** — dashboard form for project creation without CLI
- [ ] **Multiple human supervisors** — allow more than one human to send directives
- [ ] **View sub-agents and tasks** — dashboard panel showing registered agents and their task history

---

## License

MIT
