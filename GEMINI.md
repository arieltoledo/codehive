<!-- CODEHIVE_START -->
## 🐝 CodeHive Active
This project is part of a **CodeHive** swarm. 
For operational instructions and MCP server configuration, you MUST follow:
**Protocol**: .codehive/PROTOCOL.md
<!-- CODEHIVE_END -->

# Project Instructions: MCP Agent Control Room

Foundational guidance for interacting with the **MCP Agent Control Room** codebase.

## Project Overview

**MCP Agent Control Room** is a platform designed to coordinate, observe, and audit AI agents (such as Codex, Gemini, Claude Code) through a shared **Model Context Protocol (MCP)** server. It provides a central hub where agents can report status, exchange messages, and manage tasks, coupled with a real-time dashboard for human supervision.

### Core Technologies
- **Runtime:** Node.js (ESM)
- **Language:** TypeScript
- **Web Framework:** [Fastify](https://fastify.dev/)
- **MCP SDK:** [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- **ORM:** [Prisma](https://www.prisma.io/) (with SQLite for MVP)
- **Validation:** [Zod](https://zod.dev/)
- **Testing:** [Vitest](https://vitest.dev/)

### Architecture
The project follows a modular architecture with clear separation between the API, the MCP server, and the core domain logic:
- `server/`: Fastify-based backend.
  - `domain/`: Business logic, services, and error definitions.
  - `db/`: Database client and persistence.
  - `http/`: API routes and presenters.
- `mcp/`: MCP server implementation and tool registrations.
- `prisma/`: Database schema and migrations.
- `tests/`: Automated test suites (contract, backend, and integration).

---

## Building and Running

### Prerequisites
- Node.js (latest LTS recommended)
- npm

### Setup
```bash
npm install
npm run db:push  # Synchronize SQLite database schema
```

### Development
- **Main Server (Fastify):** `npm run dev`
- **MCP Server:** `npm run dev:mcp` (Uses STDIO transport)

### Build and Test
- **Build:** `npm run build`
- **Test:** `npm run test`

---

## Operational Mandates: Coordination & Delegation

- **Role:** Strict Technical Coordinator.
- **Code Modification:** The Coordinator MUST NOT modify code directly. All changes must be delegated to specialized agents.
- **Delegation Flow:**
  - **Implementation:** Assigned to `senior-developer` (architecture/complex) or `junior-developer` (standard features).
  - **Validation:** Assigned to a `qa-agent`. This agent is responsible for creating and running tests.
  - **UI/UX Debugging:** Assigned to `browser_agent` for visual validation and interactive debugging.
- **Communication Loop:** Sub-agents report results/failures to the Coordinator. The Coordinator analyzes reports and issues new Directives to the relevant developer.
- **Finality:** A phase is considered complete only after the `qa-agent` validates the implementation and the Coordinator approves the report.

---

## Project Context Files
- `Brieff.md`: Detailed product and technical brief (Source of truth for MVP scope).
- `AGENTS.md`: High-level repository guidelines and organization.


## MCP Control Room Activation

You have access to a shared Control Room via MCP. You MUST follow these protocols for coordination:

1. **Self-Registration**: Call `agent_register` immediately to announce your presence.
2. **Greeting**: Send a message to the 'coordination' room with `chat_send`.
3. **Transparent Planning**: Publish your execution plan to the shared knowledge base using `memory_publish` BEFORE making major changes.
4. **Active Listening**: Periodically check `chat_read` for human supervisor feedback.

**MCP Server Execution Command:**
`npx tsx /home/arieltoledo/Development/agents_chat_mcp/mcp/server.ts`


## CodeHive Activation 🐝

You have access to a shared CodeHive Control Room via MCP. You MUST follow these protocols for coordination:

1. **Self-Registration**: Call `agent_register` immediately to announce your presence.
2. **Greeting**: Send a message to the 'coordination' room with `chat_send`.
3. **Transparent Planning**: Publish your execution plan to the shared knowledge base using `memory_publish` BEFORE making major changes.
4. **Active Listening**: Periodically check `chat_read` for human supervisor feedback.

**MCP Server Execution Command:**
`npx tsx /home/arieltoledo/Development/agents_chat_mcp/mcp/server.ts`
