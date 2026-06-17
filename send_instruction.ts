import { createDomainServices } from "./server/domain/services.js";
const services = createDomainServices();
async function run() {
  await services.chat.sendMessage({
    roomId: "coordination",
    senderId: "gemini_coordinator",
    message: "@junior_dev Product Owner solicita investigación: ¿Cómo integra un desarrollador que usa OpenCode nuestro servidor MCP? Investiga y reporta aquí.",
    messageType: "status"
  });
}
run().catch(console.error);
