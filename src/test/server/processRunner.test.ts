import * as assert from 'node:assert';
import { EventEmitter } from 'node:events';

import { createStartupPortScanner, startRubyServer } from '../../server/processRunner';

// Minimal stand-in for a spawned ChildProcess: an EventEmitter (for 'error'
// and 'close') exposing stdout/stderr EventEmitters. Enough for the handshake.
function makeFakeProcess(): any {
  const proc: any = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = () => true;
  return proc;
}

// A fake spawn that records its calls and always returns `proc`.
function fakeSpawnReturning(proc: any): any {
  const fn: any = (command: string, args: string[], options: any) => {
    fn.calls.push({ command, args, options });
    return proc;
  };
  fn.calls = [];
  return fn;
}

const baseConfig = {
  workingDirectory: '/ws',
  useBundler: false,
  token: 'secret-token',
  libPath: '/fake/lib',
};

// The scanner is the pure core of the Ruby server's startup handshake: it
// consumes stdout chunks and yields the port from the first complete, valid
// JSON line that carries a numeric `port`. Everything else (partial lines,
// non-JSON lines, non-numeric ports) is buffered or ignored.
suite('createStartupPortScanner', () => {
  test('returns the port from a JSON line carrying a numeric port', () => {
    const scan = createStartupPortScanner();
    assert.strictEqual(scan('{"status":"success","port":7654}\n'), 7654);
  });

  test('buffers a line split across two chunks and returns the port once complete', () => {
    const scan = createStartupPortScanner();
    assert.strictEqual(scan('{"status":"success","po'), null);
    assert.strictEqual(scan('rt":7660}\n'), 7660);
  });

  test('ignores a non-JSON line and resolves on a later valid line', () => {
    const scan = createStartupPortScanner();
    assert.strictEqual(scan('Booting Ruby...\n'), null);
    assert.strictEqual(scan('{"port":7700}\n'), 7700);
  });

  test('ignores a JSON line whose port is not a number', () => {
    const scan = createStartupPortScanner();
    assert.strictEqual(scan('{"port":"7654"}\n'), null);
    assert.strictEqual(scan('{"message":"warming up"}\n'), null);
    assert.strictEqual(scan('{"port":7655}\n'), 7655);
  });

  test('returns the first numeric port when several lines arrive in one chunk', () => {
    const scan = createStartupPortScanner();
    assert.strictEqual(scan('{"log":"a"}\n{"port":7654}\n{"port":9999}\n'), 7654);
  });

  test('latches after the first port: later chunks return null', () => {
    const scan = createStartupPortScanner();
    assert.strictEqual(scan('{"port":7654}\n'), 7654);
    assert.strictEqual(scan('{"port":8888}\n'), null);
  });

  test('buffers a partial line with no newline and yields nothing yet', () => {
    const scan = createStartupPortScanner();
    assert.strictEqual(scan('{"port":7654}'), null);
    assert.strictEqual(scan('\n'), 7654);
  });
});

suite('startRubyServer', () => {
  test('resolves with the process and port when the ready line arrives', async () => {
    const proc = makeFakeProcess();
    const spawnFn = fakeSpawnReturning(proc);

    const promise = startRubyServer(baseConfig, { spawn: spawnFn });
    proc.stdout.emit('data', Buffer.from('{"status":"success","port":7654}\n'));

    const result = await promise;
    assert.strictEqual(result.process, proc);
    assert.strictEqual(result.port, 7654);
  });

  test('resolves when the ready line is split across two stdout chunks', async () => {
    const proc = makeFakeProcess();
    const promise = startRubyServer(baseConfig, { spawn: fakeSpawnReturning(proc) });

    proc.stdout.emit('data', Buffer.from('{"status":"success","po'));
    proc.stdout.emit('data', Buffer.from('rt":7660}\n'));

    assert.strictEqual((await promise).port, 7660);
  });

  test('ignores a non-JSON stdout line and resolves on a later ready line', async () => {
    const proc = makeFakeProcess();
    const promise = startRubyServer(baseConfig, { spawn: fakeSpawnReturning(proc) });

    proc.stdout.emit('data', Buffer.from('Booting...\n'));
    proc.stdout.emit('data', Buffer.from('{"port":7700}\n'));

    assert.strictEqual((await promise).port, 7700);
  });

  test('rejects when the process emits a spawn error', async () => {
    const proc = makeFakeProcess();
    const promise = startRubyServer(baseConfig, { spawn: fakeSpawnReturning(proc) });

    proc.emit('error', new Error('spawn ruby ENOENT'));

    await assert.rejects(() => promise, /Failed to spawn Ruby server: spawn ruby ENOENT/);
  });

  test('rejects with the stderr tail when the process closes before it is ready', async () => {
    const proc = makeFakeProcess();
    const promise = startRubyServer(baseConfig, { spawn: fakeSpawnReturning(proc) });

    proc.stderr.emit('data', Buffer.from('boom on stderr'));
    proc.emit('close', 1);

    await assert.rejects(() => promise, /Ruby server exited with code 1 before it was ready\. Last stderr: boom on stderr/);
  });

  test('rejects when the ready line never arrives before the startup timeout', async () => {
    const proc = makeFakeProcess();
    const promise = startRubyServer(baseConfig, { spawn: fakeSpawnReturning(proc), startupTimeoutMs: 20 });

    await assert.rejects(() => promise, /Timeout starting Ruby server/);
  });

  test('settles exactly once: a close after ready does not reject the resolved promise', async () => {
    const proc = makeFakeProcess();
    const promise = startRubyServer(baseConfig, { spawn: fakeSpawnReturning(proc) });

    proc.stdout.emit('data', Buffer.from('{"port":7654}\n'));
    const result = await promise;
    assert.strictEqual(result.port, 7654);

    // Post-ready close must not turn the already-resolved promise into a
    // rejection (which would surface as an unhandled rejection).
    proc.emit('close', 0);
    assert.strictEqual(await promise, result);
  });

  test('passes cwd, token env and args (no --use-bundler by default)', async () => {
    const proc = makeFakeProcess();
    const spawnFn = fakeSpawnReturning(proc);

    const promise = startRubyServer(baseConfig, { spawn: spawnFn });
    proc.stdout.emit('data', Buffer.from('{"port":7654}\n'));
    await promise;

    assert.strictEqual(spawnFn.calls.length, 1);
    const call = spawnFn.calls[0];
    assert.strictEqual(call.command, 'ruby');
    assert.deepStrictEqual(call.args, ['/fake/lib/server.rb', 'start']);
    assert.strictEqual(call.options.cwd, '/ws');
    assert.strictEqual(call.options.env.HAML_LINT_SERVER_TOKEN, 'secret-token');
  });

  test('appends --use-bundler when useBundler is true', async () => {
    const proc = makeFakeProcess();
    const spawnFn = fakeSpawnReturning(proc);

    const promise = startRubyServer({ ...baseConfig, useBundler: true }, { spawn: spawnFn });
    proc.stdout.emit('data', Buffer.from('{"port":7654}\n'));
    await promise;

    assert.deepStrictEqual(spawnFn.calls[0].args, ['/fake/lib/server.rb', 'start', '--use-bundler']);
  });
});
