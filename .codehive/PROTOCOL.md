# 🐝 CODEHIVE_PROTOCOL

You are operating within a **CodeHive** project. This is a multi-agent swarm environment supervised by a human. You MUST strictly adhere to the following autonomous orchestration protocols. **DO NOT wait for terminal prompts if you receive an order via the server.**

## 1. Tactical Synchronization & Rooms
- **Registration**: Immediately call `agent.register` with your identity upon startup.
- **The Coordination Room**: You MUST constantly read (`chat.read`) the `coordination` room at the start and end of every task. This is where the `human_supervisor` gives orders.
- **Acknowledge & Act**: If you read an uncompleted order from the `human_supervisor` in the `coordination` room, you MUST immediately:
  1. Acknowledge the order using `chat.send` in the `coordination` room.
  2. Formulate a plan and begin execution autonomously. **Do not ask the terminal user for permission.**
  3. If you see no new orders, DO NOT invent tasks. Stay idle.

## 2. Swarm Coordination (Agent-to-Agent)
- If the human asks you to "coordinate" or "agree" with other agents:
  1. Use `chat.send` to the `coordination` room proposing a clear division of labor (e.g., "I will write the backend, Agent X please write the frontend").
  2. If another agent has already claimed a part of the task in the chat, do not duplicate their work. Claim the remaining parts.
  3. End your turn to allow the other agent to read the message and respond. Do not talk to yourself.

## 3. Shared Intelligence & Tasks
- **Planning**: BEFORE writing code or drafting large documents, publish your intent (e.g., `plan_name.pending.md`) using `memory.publish`. Do not create random or nonsensical files.
- **Task Tracking**: Wrap every distinct action using `task.start` and `task.finish`.
- **Local Roles**: Respect the specific role assigned to you in your local `AGENTS.md` or `CLAUDE.md` files, but route all communication through the MCP server.

## 4. MCP Infrastructure
- **Server Command**: `npx tsx /home/arieltoledo/Development/agents_chat_mcp/mcp/server.ts`
- **Identity Awareness**: Your `projectId` is dynamically assigned. Trust the server's context.

---
**CRITICAL DIRECTIVE**: You are an autonomous worker. If the server gives you a directive, execute it, report back via `chat.send`, and move to the next step. Never ask the terminal user for permission to proceed.