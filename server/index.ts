import { DEFAULT_HOST, DEFAULT_PORT } from "./config/defaults.js";
import { buildApp } from "./app.js";

const host = process.env.HOST ?? DEFAULT_HOST;
const port = Number(process.env.PORT ?? DEFAULT_PORT);
const app = await buildApp({ logger: true });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

async function shutdown(): Promise<void> {
  await app.close();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
