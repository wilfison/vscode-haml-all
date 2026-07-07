import net from 'node:net';

import { Logger, ServerResponse } from './protocol';

const noop: Logger = () => {};

/**
 * Sends one request to the Ruby lint server over a fresh TCP socket and
 * resolves with the parsed response.
 *
 * The server writes a single JSON line and then closes the connection, so the
 * response is accumulated until socket-`end` and parsed exactly once. This
 * single-encode/single-decode contract is kept in sync with
 * lib/lint_server/transport.rb — do not double-encode.
 *
 * The promise settles exactly once and the socket is always destroyed on the
 * way out, so a stuck server (one that never closes the connection) cannot
 * leak the socket or hang the caller: when `timeoutMs` is given, the request is
 * rejected and the socket torn down once the budget elapses.
 *
 * @param port - TCP port the server is listening on
 * @param host - host to connect to (127.0.0.1 in production)
 * @param payload - request object; serialized verbatim (caller adds the token)
 * @param log - optional diagnostics sink
 * @param timeoutMs - optional per-request timeout; omitted means wait forever
 */
export function sendRequest(
  port: number,
  host: string,
  payload: Record<string, unknown>,
  log: Logger = noop,
  timeoutMs?: number
): Promise<ServerResponse<any>> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    // Settle exactly once and always release the socket. Late 'close'/'error'
    // events (including those triggered by destroy() itself) become no-ops.
    const settle = (finish: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      client.destroy();
      finish();
    };

    if (timeoutMs !== undefined) {
      timer = setTimeout(() => {
        settle(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)));
      }, timeoutMs);
    }

    log(`Server request: ${payload.action}`);
    client.connect(port, host, () => {
      client.write(JSON.stringify(payload) + '\n');
    });

    let data = '';

    client.on('data', (chunk) => {
      data += chunk.toString();
    });

    client.on('end', () => {
      settle(() => {
        try {
          resolve(JSON.parse(data) as ServerResponse<any>);
        } catch (e: any) {
          log(`Error parsing server response: ${e.message}`);
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    client.on('error', (err) => {
      settle(() => reject(err));
    });
  });
}
