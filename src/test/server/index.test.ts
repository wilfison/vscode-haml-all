import * as assert from 'node:assert';
import { EventEmitter } from 'node:events';

import LintServer from '../../server';
import { FakeServer, Responder, startFakeServer } from './fakeServer';

// Minimal stand-in for a spawned Ruby server: stdout/stderr emitters plus the
// 'close'/'error' events LintServer listens to.
function makeFakeProcess(): any {
  const proc: any = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = () => true;
  return proc;
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('condition never became true'));
        return;
      }
      setTimeout(check, 5);
    };

    check();
  });
}

suite('LintServer', () => {
  const workspace = '/tmp/haml-test-workspace';
  let lintServer: LintServer;
  let fakeServer: FakeServer | null;

  setup(() => {
    // outputChannel omitted → the instance has no vscode runtime dependency.
    lintServer = new LintServer(workspace, () => ({ useBundler: false, rubyCommand: 'ruby' }));
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

    // null (not the original template) is what tells the formatter the request
    // failed rather than finding nothing to correct.
    test('returns null on error status', async () => {
      await connectTo(() => JSON.stringify({ status: 'error', result: 'boom' }));

      const result = await lintServer.autocorrect('original', '/a/b.haml', '/a/.haml-lint.yml');

      assert.strictEqual(result, null);
    });

    test('returns null when the response cannot be parsed', async () => {
      await connectTo(() => null);

      const result = await lintServer.autocorrect('original', '/a/b.haml', '/a/.haml-lint.yml');

      assert.strictEqual(result, null);
    });

    test('sends linters and unsafe only when asked for', async () => {
      await connectTo(() => JSON.stringify({ status: 'success', result: 'x' }));

      await lintServer.autocorrect('original', '/a/b.haml', '/a/.haml-lint.yml');
      await lintServer.autocorrect('original', '/a/b.haml', '/a/.haml-lint.yml', { linters: ['SpaceBeforeScript'], unsafe: true });

      const plain = JSON.parse(fakeServer!.requests[0]);
      assert.ok(!('linters' in plain) && !('unsafe' in plain), 'no linters/unsafe keys by default');
      const restricted = JSON.parse(fakeServer!.requests[1]);
      assert.deepStrictEqual(restricted.linters, ['SpaceBeforeScript']);
      assert.strictEqual(restricted.unsafe, true);
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

  suite('automatic restart', () => {
    // Each spawn immediately announces a port, so start() resolves; the test then
    // drives the lifecycle by emitting 'close' on the process it got.
    function restartingServer(attempts: number) {
      const processes: any[] = [];

      const spawnFn: any = () => {
        const proc = makeFakeProcess();
        processes.push(proc);
        setImmediate(() => proc.stdout.emit('data', Buffer.from('{"port":7654}\n')));
        return proc;
      };

      const server = new LintServer('/ws', () => ({ useBundler: false, rubyCommand: 'ruby' }), null, {
        spawn: spawnFn,
        restartDelaysMs: new Array(attempts).fill(1),
      });

      return { server, processes };
    }

    test('spawns a replacement when the process dies unexpectedly', async () => {
      const { server, processes } = restartingServer(3);

      await server.start();
      assert.strictEqual(processes.length, 1);

      processes[0].emit('close', 1);

      await waitFor(() => processes.length === 2);
      assert.strictEqual(server.rubyServerProcess, processes[1]);
    });

    test('does not respawn after stop()', async () => {
      const { server, processes } = restartingServer(3);

      await server.start();
      server.stop();
      processes[0].emit('close', 0);

      await new Promise((resolve) => setTimeout(resolve, 40));

      assert.strictEqual(processes.length, 1);
      assert.strictEqual(server.rubyServerProcess, null);
    });

    test('stops respawning once the attempts are exhausted', async () => {
      const { server, processes } = restartingServer(2);
      let gaveUp = 0;

      server.setRestartHandlers({ onGaveUp: () => (gaveUp += 1) });

      await server.start();

      // Kill every replacement as soon as it appears: 1 initial + 2 attempts.
      for (let i = 0; i < 4; i += 1) {
        await waitFor(() => processes.length === Math.min(i + 1, 3));
        processes[processes.length - 1].emit('close', 1);
      }

      await waitFor(() => gaveUp === 1);

      await new Promise((resolve) => setTimeout(resolve, 40));
      assert.strictEqual(processes.length, 3);
    });

    test('restart() re-arms the attempt counter', async () => {
      const { server, processes } = restartingServer(1);
      let restarted = 0;

      server.setRestartHandlers({ onRestarted: () => (restarted += 1) });

      await server.start();

      processes[0].emit('close', 1);
      await waitFor(() => processes.length === 2);

      // The single automatic attempt is spent; a manual restart gets it back.
      await server.restart();
      assert.strictEqual(processes.length, 3);

      processes[2].emit('close', 1);
      await waitFor(() => processes.length === 4);

      assert.strictEqual(restarted, 3);
    });
  });

  // useBundler and rubyCommand only apply when the process is spawned, so the
  // server reads them on every start rather than holding the activation values.
  suite('settings are read at start time', () => {
    test('a restart picks up the current useBundler and rubyCommand', async () => {
      const spawned: { command: string; args: string[] }[] = [];
      let options = { useBundler: false, rubyCommand: 'ruby' };

      const spawnFn: any = (command: string, args: string[]) => {
        spawned.push({ command, args });
        const proc = makeFakeProcess();
        setImmediate(() => proc.stdout.emit('data', Buffer.from('{"port":7654}\n')));
        return proc;
      };

      const server = new LintServer('/ws', () => options, null, { spawn: spawnFn });

      await server.start();
      assert.strictEqual(spawned[0].command, 'ruby');
      assert.ok(!spawned[0].args.includes('--use-bundler'));

      options = { useBundler: true, rubyCommand: '/opt/rubies/3.4/bin/ruby' };
      await server.restart();

      assert.strictEqual(spawned[1].command, '/opt/rubies/3.4/bin/ruby');
      assert.ok(spawned[1].args.includes('--use-bundler'));

      server.stop();
    });
  });
});
