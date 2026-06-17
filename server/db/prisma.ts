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
  return new PrismaClient();
}
