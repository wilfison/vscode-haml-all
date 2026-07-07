import * as assert from 'node:assert';

import LintServer from '../../server';
import { FakeServer, Responder, startFakeServer } from './fakeServer';

suite('LintServer', () => {
  const workspace = '/tmp/haml-test-workspace';
  let lintServer: LintServer;
  let fakeServer: FakeServer | null;

  setup(() => {
    // outputChannel omitted → the instance has no vscode runtime dependency.
    lintServer = new LintServer(workspace, false);
    fakeServer = null;
  });

  teardown(async () => {
    if (fakeServer) {
      await fakeServer.close();
    }
  });

  // Point the client at a fake server and record it for teardown.
  async function connectTo(responder: Responder): Promise<void> {
    fakeServer = await startFakeServer(responder);
    (lintServer as any).serverPort = fakeServer.port;
  }

  suite('lint', () => {
    test('resolves offenses from a successful response', async () => {
      const offenses = [{ location: { line: 1 }, severity: 'warning', message: 'x', linter_name: 'y' }];
      await connectTo(() => JSON.stringify({ status: 'success', result: offenses }));

      let received: any = 'UNSET';
      await lintServer.lint('%p Hello', '/a/b.haml', '/a/.haml-lint.yml', (data) => {
        received = data;
      });

      assert.deepStrictEqual(received, offenses);
    });

    test('sends exactly one request carrying the action, token and params', async () => {
      await connectTo(() => JSON.stringify({ status: 'success', result: [] }));

      await lintServer.lint('%p Hello', '/a/b.haml', '/a/.haml-lint.yml', () => {});

      assert.strictEqual(fakeServer!.requests.length, 1);
      const request = JSON.parse(fakeServer!.requests[0]);
      assert.strictEqual(request.action, 'lint');
      assert.strictEqual(request.file_path, '/a/b.haml');
      assert.strictEqual(request.template, '%p Hello');
      assert.strictEqual(request.config_file, '/a/.haml-lint.yml');
      assert.strictEqual(request.workspace, workspace);
      assert.ok(typeof request.token === 'string' && request.token.length > 0, 'request must carry a non-empty token');
    });

    test('degrades to an empty array when the server reports an error status', async () => {
      await connectTo(() => JSON.stringify({ status: 'error', result: 'boom' }));

      let received: any = 'UNSET';
      await lintServer.lint('%p Hello', '/a/b.haml', '/a/.haml-lint.yml', (data) => {
        received = data;
      });

      assert.deepStrictEqual(received, []);
    });

    test('degrades to an empty array when the response is not valid JSON', async () => {
      await connectTo(() => 'this is not json');

      let received: any = 'UNSET';
      await lintServer.lint('%p Hello', '/a/b.haml', '/a/.haml-lint.yml', (data) => {
        received = data;
      });

      assert.deepStrictEqual(received, []);
    });
  });

  suite('listCops', () => {
    test('resolves the cop list from a successful response', async () => {
      const result = { haml_lint: { RuboCop: { enabled: true } } };
      await connectTo(() => JSON.stringify({ status: 'success', result }));

      let received: any = 'UNSET';
      await lintServer.listCops((data) => {
        received = data;
      });

      assert.deepStrictEqual(received, result);
    });

    test('sends the list_cops action carrying the token', async () => {
      await connectTo(() => JSON.stringify({ status: 'success', result: {} }));

      await lintServer.listCops(() => {});

      const request = JSON.parse(fakeServer!.requests[0]);
      assert.strictEqual(request.action, 'list_cops');
      assert.ok(typeof request.token === 'string' && request.token.length > 0, 'request must carry a non-empty token');
    });

    test('degrades to an empty array on error status', async () => {
      await connectTo(() => JSON.stringify({ status: 'error', result: 'nope' }));

      let received: any = 'UNSET';
      await lintServer.listCops((data) => {
        received = data;
      });

      assert.deepStrictEqual(received, []);
    });

    test('degrades to an empty array when the response is not valid JSON', async () => {
      await connectTo(() => 'garbage');

      let received: any = 'UNSET';
      await lintServer.listCops((data) => {
        received = data;
      });

      assert.deepStrictEqual(received, []);
    });
  });

  suite('autocorrect', () => {
    test('returns the corrected template on success', async () => {
      await connectTo(() => JSON.stringify({ status: 'success', result: 'fixed content' }));

      const result = await lintServer.autocorrect('original', '/a/b.haml', '/a/.haml-lint.yml');

      assert.strictEqual(result, 'fixed content');
    });

    test('returns the original template on error status', async () => {
      await connectTo(() => JSON.stringify({ status: 'error', result: 'boom' }));

      const result = await lintServer.autocorrect('original', '/a/b.haml', '/a/.haml-lint.yml');

      assert.strictEqual(result, 'original');
    });

    test('returns the original template when the response cannot be parsed', async () => {
      await connectTo(() => null);

      const result = await lintServer.autocorrect('original', '/a/b.haml', '/a/.haml-lint.yml');

      assert.strictEqual(result, 'original');
    });
  });

  suite('stop', () => {
    test('kills the running process, clears the handle and is idempotent', () => {
      let killCount = 0;
      lintServer.rubyServerProcess = {
        kill: () => {
          killCount += 1;
          return true;
        },
      } as any;

      lintServer.stop();
      assert.strictEqual(killCount, 1);
      assert.strictEqual(lintServer.rubyServerProcess, null);

      // A second stop() is a no-op: it neither throws nor kills again.
      lintServer.stop();
      assert.strictEqual(killCount, 1);
    });
  });

  suite('start', () => {
    test('is idempotent: returns the existing process without spawning a new one', async () => {
      const existing = { kill: () => true } as any;
      lintServer.rubyServerProcess = existing;

      const result = await lintServer.start();

      assert.strictEqual(result, existing);
      assert.strictEqual(lintServer.rubyServerProcess, existing);
    });
  });
});
