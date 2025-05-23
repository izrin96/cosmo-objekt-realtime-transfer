# Objekt Realtime Transfer

A simple real-time transfer monitoring for Objekt NFTs with WebSocket support.

## Tooling

- [Envio HyperSync](https://envio.dev/)
- [Hono.js](https://hono.dev)

## Setup

1. Install dependencies:

```bash
pnpm install
```

## Development

To run the application in development mode:

```bash
pnpm dev
```

## Production

To run the application in production mode:

1. Build the TypeScript files:

```bash
pnpm build
```

2. Start the application:

```bash
pnpm start
```

## Docker

To build and run the application using Docker:

1. Build the Docker image:

```bash
docker build -t objekt-transfer .
```

2. Run the container:

```bash
docker run -p 3001:3001 objekt-transfer
```

## WebSocket Client Example

You can connect to the WebSocket server using this example:

```javascript
const ws = new WebSocket("ws://localhost:3001");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received transfer:", data);
};
```

## Credit/Acknowledgment

- [teamreflex/cosmo-web](https://github.com/teamreflex/cosmo-web) for Cosmo fetch metadata method
