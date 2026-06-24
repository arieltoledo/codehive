import { fileURLToPath } from "node:url";
import path from "node:path";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";

import { DomainError } from "./domain/errors.js";
import { createDomainServices, type DomainServices } from "./domain/services.js";
import { registerRoutes } from "./http/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

export interface BuildAppOptions {
  logger?: boolean | FastifyBaseLogger;
  services?: DomainServices;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const services = options.services ?? createDomainServices();
  const app = Fastify({
    logger: options.logger ?? false
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error."
      }
    });
  });

  await app.register(websocket);

  // Heartbeat — ping all WS clients every 30s to prevent idle disconnects
  const HEARTBEAT_INTERVAL = 30_000;
  const heartbeatTimer = setInterval(() => {
    const wss = (app as any).websocketServer;
    if (!wss?.clients) return;
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL);

  app.addHook('onClose', (_instance, done) => {
    clearInterval(heartbeatTimer);
    clearInterval(scheduleCheckTimer);
    done();
  });

  // Schedule checker — process due wake-ups every 60s
  const SCHEDULE_CHECK_INTERVAL = 60_000;
  const scheduleCheckTimer = setInterval(async () => {
    try {
      const due = await services.schedules.processDueSchedules();
      for (const s of due) {
        services.events.emit("schedule_completed", s);
      }
    } catch (err) {
      app.log.error({ err }, "Schedule check error");
    }
  }, SCHEDULE_CHECK_INTERVAL);

  await app.register(multipart);

  await app.register(fastifyStatic, {
    root: path.join(PROJECT_ROOT, "web", "dist"),
    prefix: "/"
  });

  await registerRoutes(app, services);

  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api")) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Resource not found"
        }
      });
    }
    return reply.sendFile("index.html");
  });

  return app;
}
