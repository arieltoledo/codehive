import type { FastifyRequest } from "fastify";

import type { DomainServices } from "../domain/services.js";
import type { DomainEvent } from "../domain/types.js";
import {
  toAgentDto,
  toGoalDto,
  toMessageDto,
  toTaskDto,
  toFileClaimDto,
  toDecisionDto,
  toSubagentDto,
  toSubagentInstanceDto
} from "./presenters.js";

const roomChannels = new Map<string, Set<any>>();

export function handleWebsocket(
  connection: any,
  req: FastifyRequest,
  services: DomainServices
): void {
  const { events } = services;
  const socket = connection.socket || connection;

  if (!socket || typeof socket.on !== 'function') {
    req.log.error({
      hasConnection: !!connection,
      hasSocket: !!connection?.socket,
      socketType: typeof socket
    }, "Invalid WebSocket connection object received");
    return;
  }

  const roomId = (req.query as Record<string, string>)?.roomId;
  const projectId = roomId ? roomId.split('::')[1] : null;

  if (roomId) {
    if (!roomChannels.has(roomId)) {
      roomChannels.set(roomId, new Set());
    }
    roomChannels.get(roomId)!.add(socket);
    req.log.info({ roomId }, "WebSocket registered to room channel");
  } else {
    req.log.info("WebSocket connected (dashboard mode — all events)");
  }

  const eventTypes: Array<DomainEvent["type"]> = [
    "agent_registered",
    "agent_updated",
    "message_sent",
    "task_started",
    "task_finished",
    "file_claimed",
    "file_released",
    "decision_recorded",
    "memory_updated",
    "schedule_created",
    "schedule_completed",
    "schedule_cancelled",
    "session_saved",
    "goal_started",
    "goal_updated",
    "goal_completed",
    "goal_paused",
    "goal_claimed",
    "subagent_created",
    "subagent_updated",
    "subagent_deleted",
    "subagent_launched",
    "subagent_instance_created",
    "subagent_instance_completed",
    "subagent_instance_error",
    "project_init_step",
    "project_init_done",
    "project_init_error",
  ];

  const handlers = eventTypes.map((type) => {
    const handler = (payload: any) => {
      if (roomId) {
        const eventRoomId = payload?.roomId;
        const eventProjectId = payload?.projectId;
        if (eventRoomId && eventRoomId !== roomId) return;
        if (!eventRoomId && eventProjectId && eventProjectId !== projectId) return;
      }

      if (socket.readyState !== 1) return;

      let dto = payload;

      if (type === "agent_registered" || type === "agent_updated") {
        dto = toAgentDto(payload);
      } else if (type === "message_sent") {
        dto = toMessageDto(payload);
      } else if (type === "task_started" || type === "task_finished") {
        dto = toTaskDto(payload);
      } else if (type === "file_claimed" || type === "file_released") {
        dto = toFileClaimDto(payload);
      } else if (type === "decision_recorded") {
        dto = toDecisionDto(payload);
      } else if (type.startsWith("goal_")) {
        dto = toGoalDto(payload);
      } else if (type.startsWith("subagent_")) {
        if (type === "subagent_deleted") {
          dto = payload;
        } else if (type === "subagent_instance_created" || type === "subagent_instance_completed" || type === "subagent_instance_error") {
          dto = toSubagentInstanceDto(payload);
        } else {
          dto = toSubagentDto(payload);
        }
      }

      socket.send(JSON.stringify({ type, payload: dto }));
    };
    events.on(type, handler);
    return { type, handler };
  });

  socket.on("close", () => {
    if (roomId) {
      const channel = roomChannels.get(roomId);
      if (channel) {
        channel.delete(socket);
        if (channel.size === 0) {
          roomChannels.delete(roomId);
        }
      }
    }
    handlers.forEach(({ type, handler }) => {
      events.off(type, handler);
    });
    req.log.info({ roomId: roomId ?? "dashboard" }, "WebSocket disconnected");
  });

  socket.isAlive = true;
  socket.on("pong", () => { socket.isAlive = true; });

  socket.on("error", (error: any) => {
    req.log.error(error, "WebSocket error");
  });
}
