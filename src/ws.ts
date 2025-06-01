import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";

const app = new Hono();

const wss = new WebSocketServer({ noServer: true });

const clients = new Set<WebSocket>();

wss.on("connection", async (ws) => {
  clients.add(ws);

  ws.on("close", () => {
    clients.delete(ws);
  });
});

export async function broadcast(message: any) {
  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

app.get("/", (c) => c.text("WebSocket server is running"));

const port = 3001;
console.log(`WebSocket server is running on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

server.on("upgrade", (request: IncomingMessage, socket: any, head: Buffer) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
