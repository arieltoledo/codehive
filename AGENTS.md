# Repository Guidelines

## Project Structure & Module Organization

This repository centers on `Brieff.md`, the product and technical brief for MCP Agent Control Room. Treat it as the source of truth until code is added.

Use the planned MVP structure from the brief:

- `server/` for the Node.js/TypeScript backend, Fastify API, WebSocket event bus, and persistence layer.
- `mcp/` for MCP tools such as `agent.register`, `chat.send`, `chat.read`, `task.*`, `file.*`, and `human.notify`.
- `web/` for the React/Vite dashboard.
- `prisma/` for SQLite schema and migrations.
- `tests/` for backend, MCP tool, and integration tests.
- `docs/` for integration notes, architecture decisions, and agent setup.

Keep MCP tool logic decoupled from the dashboard; the dashboard should consume HTTP/WebSocket APIs.

## Build, Test, and Development Commands

No package manifest is present yet. When scaffolding begins, add documented scripts:

- `npm install` installs workspace dependencies.
- `npm run dev` starts the backend, MCP server, and dashboard for local development.
- `npm run build` compiles TypeScript and builds the dashboard.
- `npm test` runs automated tests.
- `docker compose up --build` starts the optional local stack.

Update this section when `package.json` or `docker-compose.yml` is introduced.

## Coding Style & Naming Conventions

Use TypeScript for backend, MCP, and frontend code. Prefer 2-space indentation, explicit exported types, and small domain modules: `agents`, `chat`, `tasks`, `files`, `decisions`, and `human`.

Name MCP tools with dotted, verb-oriented identifiers from the brief, for example `agent.update_status` and `decision.record`. Use `camelCase` for TypeScript variables/functions, `PascalCase` for React components/classes, and `SCREAMING_SNAKE_CASE` for environment variables.

## Testing Guidelines

Prioritize MCP tool contracts, persistence behavior, and WebSocket event emission. Integration tests should verify that two agents can register, send messages, read shared history, and appear in dashboard-facing state.

Place tests under `tests/` or next to source files as `*.test.ts`. Keep fixtures small and deterministic.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout, so no existing convention can be verified. Use concise imperative commits such as `Add MCP chat tools` or `Wire dashboard websocket events`.

Pull requests should include a short purpose statement, commands run, data model changes, and screenshots or recordings for dashboard changes. Link related issues or brief sections when relevant.

## Security & Configuration Tips

Keep secrets out of source control. Use `.env` for database paths, ports, and auth tokens. The MVP should default to local SQLite and avoid exposing control endpoints beyond localhost unless explicitly configured.


## MCP Control Room Activation

You have access to a shared Control Room via MCP. You MUST follow these protocols for coordination:

1. **Self-Registration**: Call `agent.register` immediately to announce your presence.
2. **Greeting**: Send a message to the 'coordination' room with `chat.send`.
3. **Transparent Planning**: Publish your execution plan to the shared knowledge base using `memory.publish` BEFORE making major changes.
4. **Active Listening**: Periodically check `chat.read` for human supervisor feedback.

**MCP Server Execution Command:**
`npx tsx /home/arieltoledo/Development/agents_chat_mcp/mcp/server.ts`


## CodeHive Activation 🐝

You have access to a shared CodeHive Control Room via MCP. You MUST follow these protocols for coordination:

1. **Self-Registration**: Call `agent.register` immediately to announce your presence.
2. **Greeting**: Send a message to the 'coordination' room with `chat.send`.
3. **Transparent Planning**: Publish your execution plan to the shared knowledge base using `memory.publish` BEFORE making major changes.
4. **Active Listening**: Periodically check `chat.read` for human supervisor feedback.

**MCP Server Execution Command:**
`npx tsx /home/arieltoledo/Development/agents_chat_mcp/mcp/server.ts`
