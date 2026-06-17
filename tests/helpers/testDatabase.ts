import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { createDomainServices, type DomainServices } from "../../server/domain/services.js";

export interface TestContext {
  databaseUrl: string;
  prisma: PrismaClient;
  services: DomainServices;
  cleanup: () => Promise<void>;
}

async function initializeSchema(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "agents" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "parent_agent_id" TEXT,
      "status" TEXT NOT NULL DEFAULT 'idle',
      "current_task_id" TEXT,
      "last_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "rooms" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "project_id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "messages" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "room_id" TEXT NOT NULL,
      "sender_id" TEXT NOT NULL,
      "sender_type" TEXT NOT NULL DEFAULT 'agent',
      "message_type" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "task_id" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "messages_room_id_created_at_idx" ON "messages" ("room_id", "created_at")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "tasks" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "assigned_agent_id" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL,
      "finished_at" DATETIME
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "file_claims" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "agent_id" TEXT NOT NULL,
      "task_id" TEXT,
      "file_path" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "released_at" DATETIME
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "file_claims_agent_id_status_idx" ON "file_claims" ("agent_id", "status")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "decisions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "agent_id" TEXT NOT NULL,
      "task_id" TEXT,
      "decision" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX "decisions_agent_id_created_at_idx" ON "decisions" ("agent_id", "created_at")
  `);
}

export async function createTestContext(): Promise<TestContext> {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const databaseDir = mkdtempSync(join(tmpdir(), "mcp-agent-control-room-"));
  const databaseUrl = `file:${join(databaseDir, "test.db")}`;

  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
  await initializeSchema(prisma);

  const services = createDomainServices(prisma);

  return {
    databaseUrl,
    prisma,
    services,
    cleanup: async () => {
      await prisma.$disconnect();

      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }

      rmSync(databaseDir, { force: true, recursive: true });
    }
  };
}
