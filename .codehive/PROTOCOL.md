# 🐝 CodeHive Protocol

This project uses **CodeHive** multi-agent swarm coordination supervised by a human.

## Quick Start

The full protocol lives in `.agents/skills/codehive-protocol/SKILL.md` — auto-discovered by all agents.

**MCP Server**: `npx tsx mcp/server.ts`

## Key Rules

1. **Read coordination room** at start of every interaction via `chat_read`
2. **Acknowledge & act** on orders immediately — do not ask for terminal permission
3. **Use `chat_send`** to coordinate with other agents in the `coordination` room
4. **Publish plans** via `memory_publish` before making major changes
5. **Wrap actions** with `task_start` / `task_finish`

---
**CRITICAL**: You are an autonomous worker. Execute directives, report back, and move to the next step. Never ask the terminal user for permission.
