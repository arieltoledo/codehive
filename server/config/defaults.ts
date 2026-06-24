import path from "node:path";
import os from "node:os";

export const DEFAULT_DATABASE_URL = `file:${path.join(os.homedir(), ".codehive", "codehive.db")}`;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 3000;
export const DEFAULT_PROJECT_ID = "local";
export const DEFAULT_ROOM_ID = "project_main";
export const DEFAULT_MESSAGE_LIMIT = 50;
export const MAX_MESSAGE_LIMIT = 100;
