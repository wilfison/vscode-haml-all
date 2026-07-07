import * as net from 'node:net';

// A responder receives the parsed request (or null when it was not valid JSON)
// plus the raw request line, and returns the exact string to write back before
// the socket is closed. Returning null closes the connection with no body,
// which lets tests characterize the "empty/unparseable response" paths.
export type Responder = (request: any, raw: string) => string | null;

export interface FakeServerOptions {
  // When false, the socket is left open after replying (or after receiving the
  // request when the responder returns null) instead of being closed. Lets a
  // test drive the client's per-request timeout. Defaults to true.
  closeAfterResponse?: boolean;
}

export interface FakeServer {
  port: number;
  requests: string[];
  // Number of client connections still open server-side. After the client
  // destroys its socket on timeout/error, its connection drops to 0 here —
  // proving the transport released the socket rather than leaking it.
  openConnections: () => number;
  close: () => Promise<void>;
}

// Stands in for the Ruby lint server: a real in-process TCP listener on an
// ephemeral port. It reads one newline-terminated request, records it, writes
// the responder's reply and (by default) closes the socket — mirroring
// lib/lint_server's close-per-response framing that the client transport
// relies on.
export function startFakeServer(responder: Responder, options: FakeServerOptions = {}): Promise<FakeServer> {
  const closeAfterResponse = options.closeAfterResponse ?? true;

  return new Promise((resolve, reject) => {
    const requests: string[] = [];
    const sockets = new Set<net.Socket>();

    const server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));

      let buffer = '';
      let responded = false;

      socket.on('data', (chunk) => {
        if (responded) {
          return;
        }

        buffer += chunk.toString();
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
          return;
        }

        responded = true;
        const line = buffer.slice(0, newlineIndex);
        requests.push(line);

        let parsed: any = null;
        try {
          parsed = JSON.parse(line);
        } catch {
          parsed = null;
        }

        const response = responder(parsed, line);
        if (response !== null) {
          socket.write(response);
        }
        if (closeAfterResponse) {
          socket.end();
        }
      });
    });

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      resolve({
        port,
        requests,
        openConnections: () => sockets.size,
        close: () =>
          new Promise((done) => {
            for (const socket of sockets) {
              socket.destroy();
            }
            server.close(() => done());
          }),
      });
    });
  });
}
