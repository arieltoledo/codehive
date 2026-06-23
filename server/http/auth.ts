import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".codehive");
const MASTER_KEY_PATH = path.join(GLOBAL_CONFIG_DIR, "master.key");

let cachedKey: string | null | undefined = undefined;

export async function getTrustedKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;

  const envKey = process.env.HIVE_API_KEY;
  if (envKey) {
    cachedKey = envKey.trim();
    return cachedKey;
  }

  try {
    const key = await fs.readFile(MASTER_KEY_PATH, "utf-8");
    cachedKey = key.trim() || null;
  } catch {
    cachedKey = null;
  }

  return cachedKey;
}
