import type { FastifyRequest } from "fastify";

import type { DomainServices } from "../domain/services.js";
import type { DomainEvent } from "../domain/types.js";
import {
  toAgentDto,
  toGoalDto,
  toMessageDto,
  toTaskDto,
  toFileClaimDto,
  toDecisionDto
} from "./presenters.js";

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
  ];

  const handlers = eventTypes.map((type) => {
    const handler = (payload: any) => {
      req.log.info({ type }, "Broadcasting event over WebSocket");
      if (socket.readyState === 1) { // OPEN
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
        }

        socket.send(JSON.stringify({ type, payload: dto }));
      } else {
        req.log.warn({ type, state: socket.readyState }, "WebSocket not open, cannot broadcast");
      }
    };
    events.on(type, handler);
    return { type, handler };
  });

  socket.on("close", () => {
    handlers.forEach(({ type, handler }) => {
      events.off(type, handler);
    });
  });

  // Mark as alive for heartbeat detection
  socket.isAlive = true;
  socket.on("pong", () => { socket.isAlive = true; });

  socket.on("error", (error: any) => {
    req.log.error(error, "WebSocket error");
  });
}
