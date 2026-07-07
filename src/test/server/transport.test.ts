import * as assert from 'node:assert';

import { sendRequest } from '../../server/transport';
import { FakeServer, startFakeServer } from './fakeServer';

suite('sendRequest', () => {
  let fakeServer: FakeServer | null;

  setup(() => {
    fakeServer = null;
  });

  teardown(async () => {
    if (fakeServer) {
      await fakeServer.close();
    }
  });

  test('sends the payload single-encoded and resolves the single-decoded response', async () => {
    fakeServer = await startFakeServer(() => JSON.stringify({ status: 'success', result: [1, 2, 3] }));

    const payload = { action: 'lint', token: 'abc', template: '%p Hi' };
    const response = await sendRequest(fakeServer.port, '127.0.0.1', payload);

    assert.deepStrictEqual(response, { status: 'success', result: [1, 2, 3] });
    assert.strictEqual(fakeServer.requests.length, 1);
    // Exactly one JSON encoding of the payload, newline-terminated.
    assert.strictEqual(fakeServer.requests[0], JSON.stringify(payload));
  });

  test('rejects when the response is not valid JSON', async () => {
    fakeServer = await startFakeServer(() => 'not json at all');

    await assert.rejects(
      () => sendRequest(fakeServer!.port, '127.0.0.1', { action: 'lint' }),
      /Failed to parse response/
    );
  });

  test('rejects when no server is listening on the port', async () => {
    // Bind then immediately close to obtain a port that is (almost certainly)
    // free, so the connect attempt is refused.
    const throwaway = await startFakeServer(() => null);
    const deadPort = throwaway.port;
    await throwaway.close();

    await assert.rejects(() => sendRequest(deadPort, '127.0.0.1', { action: 'lint' }));
  });

  test('rejects and tears down the socket when the request exceeds the timeout', async () => {
    // A server that receives the request but never replies or closes.
    fakeServer = await startFakeServer(() => null, { closeAfterResponse: false });

    await assert.rejects(
      () => sendRequest(fakeServer!.port, '127.0.0.1', { action: 'lint' }, undefined, 30),
      /timed out after 30ms/
    );

    // The transport must have destroyed its socket, so the server-side
    // connection drops to zero rather than lingering.
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.strictEqual(fakeServer!.openConnections(), 0);
  });
});
