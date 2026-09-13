/**
 * Start-up handshake: the server announces readiness as a JSON line carrying its port
 * (lib/server.rb#notify), which can arrive split, so stdout is scanned line by line.
 */

import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';

import { Logger, TIMEOUTS } from './protocol';
import { splitCommand } from '../utils/command';
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
  /** Ruby interpreter to run (`hamlAll.rubyCommand`); may carry arguments. */
  rubyCommand?: string;
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
 * Spawns the server, resolving with the live process and its port, rejecting on a spawn
 * failure, an early exit or a missed timeout. Settles once: callers own the lifecycle.
 */
export function startRubyServer(config: RubyServerConfig, deps: RubyServerDeps = {}): Promise<StartedRubyServer> {
  const spawnFn = deps.spawn ?? spawn;
  const log = deps.log ?? (() => {});
  const startupTimeoutMs = deps.startupTimeoutMs ?? TIMEOUTS.startupMs;

  const libPath = config.libPath ?? defaultLibPath();

  // The interpreter is configurable (a GUI-launched VS Code cannot see rbenv shims) and
  // may carry arguments, which go to spawn's argv: the value comes from settings.
  const [executable, ...interpreterArgs] = splitCommand(config.rubyCommand || 'ruby');

  const args = [...interpreterArgs, `${libPath}/server.rb`, 'start'];
  if (config.useBundler) {
    args.push('--use-bundler');
  }

  return new Promise<StartedRubyServer>((resolve, reject) => {
    log(`Starting Ruby server with args: ${args.join(' ')}`);

    const rubyProcess = spawnFn(executable, args, {
      cwd: config.workingDirectory,
      env: { ...process.env, HAML_LINT_SERVER_TOKEN: config.token },
    });

    const scan = createStartupPortScanner();
    let stderrBuffer = '';
    let settled = false;

    const stderrTail = () => (stderrBuffer.trim() ? ` Last stderr: ${stderrBuffer.trim()}` : '');

    // Settles the start-up promise exactly once, with every listener left attached:
    // detaching stdout would discard everything the server says after boot.
    const finish = (settle: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
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
      const notFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
      const message = notFound
        ? `Failed to spawn "${executable}": not found. Set hamlAll.rubyCommand to your Ruby path.`
        : `Failed to spawn Ruby server: ${error.message}`;

      finish(() => reject(new Error(message)));
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
 * A stateful scanner over stdout: feed it each chunk and it buffers partial lines until
 * a JSON line with a numeric `port` appears. Every call after that returns null.
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
