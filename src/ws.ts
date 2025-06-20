import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { MAX_HISTORY, redis, TRANSFER_HISTORY_KEY } from "./lib/redis";

const app = new Hono();

const wss = new WebSocketServer({ noServer: true });

const clients = new Set<WebSocket>();

wss.on("connection", async (ws) => {
  clients.add(ws);

  redis.lRange(TRANSFER_HISTORY_KEY, 0, -1).then((history) => {
    if (history.length > 0) {
      const parsed = history.map((item) => JSON.parse(item));

      const historyMessage = {
        type: "history",
        data: parsed,
      };
      ws.send(JSON.stringify(historyMessage));
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

export async function broadcast<T>(message: { type: string; data: T[] }) {
  if (message.type === "transfer") {
    await redis.lPush(
      TRANSFER_HISTORY_KEY,
      // should be ascending order with lPush
      message.data.toReversed().map((a) => JSON.stringify(a))
    );
    await redis.lTrim(TRANSFER_HISTORY_KEY, 0, MAX_HISTORY);
  }

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
