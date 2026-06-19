import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SubscribeRequestSchema, UnsubscribeRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const API_URL = process.env.API_URL ?? "http://127.0.0.1:3000";
const RESOURCE_URI = "codehive://messages/coordination";

function fetchMessages() {
  return fetch(`${API_URL}/api/projects/local/messages?roomId=coordination&limit=10`)
    .then((r) => r.json() as any)
    .then((d) => d.messages ?? []);
}

export function registerCoordinationResource(server: McpServer) {
  server.server.registerCapabilities({ resources: { subscribe: true } });

  server.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    if (request.params.uri === RESOURCE_URI) {
      return {};
    }
    return {};
  });

  server.server.setRequestHandler(UnsubscribeRequestSchema, async () => {
    return {};
  });

  let ws: WebSocket;
  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "message_sent" && (data.payload?.room_id ?? data.payload?.roomId) === "coordination") {
          server.server.sendResourceUpdated({ uri: RESOURCE_URI });
        }
      } catch {}
    };
    ws.onclose = () => setTimeout(connect, 5000);
    ws.onerror = () => ws.close();
  }
  connect();

  server.registerResource(
    "coordination-messages",
    RESOURCE_URI,
    {
      description: "Recent messages from the coordination room",
      mimeType: "application/json",
    },
    async (uri) => {
      const messages = await fetchMessages();
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(messages, null, 2),
        }],
      };
    },
  );
}
