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
│   ├── server.ts        # Server + 12 tool registrations
│   └── tools/
│       ├── agent.ts     # agent_register, agent_update_status
│       ├── chat.ts      # chat_send, chat_read
│       ├── task.ts      # task_start, task_finish
│       ├── traceability.ts  # claim/release/record_decision
│       └── memory.ts   # publish/list/read
├── cli/                 # CLI tooling
│   └── index.ts         # hive init (interactive agent configurator)
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

### 3. Configure Agents

After `hive init`, each selected agent will have the CodeHive MCP server injected into its config. Restart the agent and it will automatically connect to the hive.

### 4. Open the Dashboard

Navigate to [http://localhost:3000](http://localhost:3000) to see the real-time control room with all connected agents, messages, tasks, and the shared knowledge base.

---

## Agent Behavioral Protocol

Every agent operating in a CodeHive swarm follows `.codehive/PROTOCOL.md`:

1. **Register** via `agent_register` on startup
2. **Read the coordination room** at the start and end of every task
3. **Acknowledge and act** on human orders immediately (do not wait for terminal input)
4. **Negotiate labor division** via `chat_send` in the coordination room
5. **Publish plans** as `.pending.md` files before making major changes
6. **Wrap every action** with `task_start` / `task_finish` for full audit trail
7. **Use `memory_publish`** for shared intelligence across the swarm

---

## License

MIT
