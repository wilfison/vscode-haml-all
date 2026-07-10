/**
 * Startup-handshake helpers for the Ruby lint server process.
 *
 * The Ruby server announces readiness by printing a single JSON line to stdout
 * that carries the bound port (see lib/server.rb#notify). Because that line may
 * arrive split across chunks or interleaved with other output, we scan stdout
 * line by line and only accept the first complete, valid JSON line whose `port`
 * is a number.
 */

import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';

import { Logger, TIMEOUTS } from './protocol';
import { getExtensionRoot } from '../utils/extensionRoot';

/** Where the extension ships the Ruby server (`lib/` under the extension root). */
function defaultLibPath(): string {
  return path.join(getExtensionRoot(), 'lib');
}

export interface RubyServerConfig {
  /** Working directory for the Ruby process; also confines config resolution. */
  workingDirectory: string;
  /** Whether to launch through Bundler (`--use-bundler`). */
  useBundler: Boolean;
  /** Per-session secret handed to the child via HAML_LINT_SERVER_TOKEN. */
  token: string;
  /** Override the bundled `lib/` location (defaults to the packaged path). */
  libPath?: string;
}

export interface RubyServerDeps {
  /** Injectable spawn (defaults to node's). Tests pass a fake child process. */
  spawn?: typeof spawn;
  /** Diagnostics sink. */
  log?: Logger;
  /** Startup timeout in ms (defaults to TIMEOUTS.startupMs). */
  startupTimeoutMs?: number;
}

export interface StartedRubyServer {
  process: ChildProcessWithoutNullStreams;
  port: number;
}

/**
 * Spawns the Ruby lint server and resolves once it announces its port.
 *
 * Resolves with the live process and the bound port; rejects on spawn failure
 * (e.g. `ruby` not on PATH), on the process exiting before it is ready, or when
 * the start-up line does not arrive within the startup timeout. The promise
 * settles exactly once — callers own the process lifecycle after that (attach
 * their own long-lived 'close'/'error' handlers).
 */
export function startRubyServer(config: RubyServerConfig, deps: RubyServerDeps = {}): Promise<StartedRubyServer> {
  const spawnFn = deps.spawn ?? spawn;
  const log = deps.log ?? (() => {});
  const startupTimeoutMs = deps.startupTimeoutMs ?? TIMEOUTS.startupMs;

  const libPath = config.libPath ?? defaultLibPath();
  const args = [`${libPath}/server.rb`, 'start'];
  if (config.useBundler) {
    args.push('--use-bundler');
  }

  return new Promise<StartedRubyServer>((resolve, reject) => {
    log(`Starting Ruby server with args: ${args.join(' ')}`);

    const rubyProcess = spawnFn('ruby', args, {
      cwd: config.workingDirectory,
      env: { ...process.env, HAML_LINT_SERVER_TOKEN: config.token },
    });

    const scan = createStartupPortScanner();
    let stderrBuffer = '';
    let settled = false;

    const stderrTail = () => (stderrBuffer.trim() ? ` Last stderr: ${stderrBuffer.trim()}` : '');

    // Settle the start-up promise exactly once and stop watching stdout. The
    // 'close'/'error' handlers stay attached but become no-ops once settled.
    const finish = (settle: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      rubyProcess.stdout.off('data', onStdout);
      settle();
    };

    const onStdout = (data: Buffer): void => {
      log(`Server output: ${data}`);
      const port = scan(data.toString());
      if (port !== null) {
        finish(() => resolve({ process: rubyProcess, port }));
      }
    };
    rubyProcess.stdout.on('data', onStdout);

    // Ruby/Bundler emit benign warnings to stderr on a healthy start, so
    // collect them for diagnostics instead of failing the launch outright.
    rubyProcess.stderr.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
      log(`Server stderr: ${data}`);
    });

    // A spawn failure (e.g. `ruby` not on PATH -> ENOENT) is delivered as an
    // event; without this listener Node rethrows it and crashes the host.
    rubyProcess.on('error', (error) => {
      finish(() => reject(new Error(`Failed to spawn Ruby server: ${error.message}`)));
    });

    rubyProcess.on('close', (code) => {
      log(`Server process exited with code ${code}`);
      finish(() => reject(new Error(`Ruby server exited with code ${code} before it was ready.${stderrTail()}`)));
    });

    // Fail the launch if the start-up line never arrives.
    const timeout = setTimeout(() => {
      finish(() => reject(new Error(`Timeout starting Ruby server.${stderrTail()}`)));
    }, startupTimeoutMs);
  });
}

/**
 * Creates a stateful scanner over a process's stdout.
 *
 * Call the returned function with each stdout chunk. It buffers partial lines
 * across calls and returns the port as soon as a complete JSON line with a
 * numeric `port` is seen; every subsequent call returns null (the port is
 * learned exactly once). Non-JSON lines and lines without a numeric `port` are
 * ignored.
 */
export function createStartupPortScanner(): (chunk: string) => number | null {
  let buffer = '';
  let found = false;

  return (chunk: string): number | null => {
    if (found) {
      return null;
    }

    buffer += chunk;

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        try {
          const response = JSON.parse(line);
          if (typeof response.port === 'number') {
            found = true;
            return response.port;
          }
        } catch {
          // A partial or non-JSON line is expected on the way up; skip it.
        }
      }

      newlineIndex = buffer.indexOf('\n');
    }

    return null;
  };
}
