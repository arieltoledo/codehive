import { spawn } from 'child_process';

const mcp = spawn('npx', ['tsx', 'mcp/server.ts']);

mcp.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data}`);
});

mcp.stderr.on('data', (data) => {
  console.error(`STDERR: ${data}`);
});

const req = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" }
  }
};

mcp.stdin.write(JSON.stringify(req) + '\n');

setTimeout(() => {
  const req2 = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };
  mcp.stdin.write(JSON.stringify(req2) + '\n');
}, 1000);

setTimeout(() => {
  mcp.kill();
}, 2000);
