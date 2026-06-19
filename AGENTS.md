<!-- CODEHIVE_START -->
## 🐝 CodeHive Active
This project is part of a **CodeHive** swarm. 
For operational instructions and MCP server configuration, you MUST follow:
**Protocol**: .codehive/PROTOCOL.md
<!-- CODEHIVE_END -->

# 🐝 CodeHive Orchestration Guidelines

Welcome to the **CodeHive** core repository. You are operating at the heart of the enjambre (swarm).

## 🌍 Global Identity & Security
- **Human Identity**: The `human_supervisor` is authenticated via a Global Master Key. You are an **Agent**. You cannot impersonate the supervisor or perform administrative tasks (project creation/deletion).
- **Project Isolation**: Every directory is a unique hive. Your actions are scoped to the current `projectId`.

## 📜 Rules of Engagement
To maintain high-performance coordination, you MUST adhere to the **CodeHive Protocol**:

1.  **Acknowledge & Act**: Upon receiving an order in the `coordination` room, acknowledge it via `chat_send` and begin execution immediately.
2.  **Autonomous Initiative**: Do not wait for terminal input if the Hive Server has issued a directive.
3.  **Swarm Coordination**: If working with other agents, use the chat to negotiate labor division. Propose a plan, end your turn, and wait for a response if necessary.
4.  **Intelligence Publishing**: Save plans as `.pending.md` in the Knowledge Base using `memory_publish` for human verification.
5.  **Audit Trail**: Wrap every discrete action in `task_start` and `task_finish`.

## 🛠️ Tooling Guidelines
- **CodeGraph**: Use for deep structural analysis before proposing architectural changes.
- **MCP Server**: Your primary communication bus. Execute as `npx tsx mcp/server.ts`.
- **Traceability**: Record critical decisions using `traceability_record_decision`.

---
**CRITICAL**: You are part of a swarm. Your primary goal is to be **Observable, Autonomous, and Secure.**

