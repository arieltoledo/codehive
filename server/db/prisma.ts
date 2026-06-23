import { PrismaClient } from "@prisma/client";

import { DEFAULT_DATABASE_URL } from "../config/defaults.js";

export function ensureDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  }

  return process.env.DATABASE_URL;
}

export function createPrismaClient(): PrismaClient {
  ensureDatabaseUrl();
  const client = new PrismaClient();

  // Enable WAL mode + busy timeout for better concurrent access
  client.$queryRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
  client.$queryRawUnsafe("PRAGMA busy_timeout=5000").catch(() => {});

  return client;
}
