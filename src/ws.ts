import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { redis, TRANSFER_HISTORY_KEY, MAX_HISTORY } from "./lib/redis";

const app = new Hono();

const wss = new WebSocketServer({ noServer: true });

const clients = new Set<WebSocket>();

wss.on("connection", async (ws) => {
  clients.add(ws);

  // Send transfer history to new client
  const history = await redis.lRange(TRANSFER_HISTORY_KEY, 0, -1);
  if (history.length > 0) {
    const historyMessage = {
      type: "history",
      data: history.map((item) => JSON.parse(item)),
    };
    ws.send(JSON.stringify(historyMessage));
  }

  ws.on("close", () => {
    clients.delete(ws);
  });
});

export async function broadcast(message: any) {
  const messageStr = JSON.stringify(message);

  if (message.type === "transfer") {
    // Store transfer event in Redis
    await redis.lPush(TRANSFER_HISTORY_KEY, JSON.stringify(message.data));
    // Trim the list to keep only the last MAX_HISTORY events
    await redis.lTrim(TRANSFER_HISTORY_KEY, 0, MAX_HISTORY - 1);
  }

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
