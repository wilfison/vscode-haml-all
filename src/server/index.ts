import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import crypto from 'node:crypto';

import { LinterOffense } from '../types';
import { OutputChannel } from 'vscode';

import { ACTIONS, CallbackFunc, ServerResponse, TIMEOUTS } from './protocol';
import { sendRequest } from './transport';
import { startRubyServer } from './processRunner';

/** Backoff before each automatic restart attempt; its length is the attempt cap. */
const RESTART_DELAYS_MS = [1000, 4000, 16000];

/** Settings the server process is spawned with, read fresh on every start. */
export interface LintServerOptions {
  useBundler: boolean;
  rubyCommand: string;
}

export interface LintServerDeps {
  /** Injectable spawn, forwarded to startRubyServer. Tests pass a fake. */
  spawn?: typeof spawn;
  /** Overrides {@link RESTART_DELAYS_MS} so tests do not wait seconds. */
  restartDelaysMs?: number[];
}

export interface RestartHandlers {
  /** Called after the server is back up, automatically or on demand. */
  onRestarted?: () => void;
  /** Called once the automatic attempts are exhausted. */
  onGaveUp?: () => void;
  /** Called whenever a server process is up, initial start included. */
  onStarted?: () => void;
  /** Called when a start attempt fails (spawn error, handshake timeout). */
  onFailed?: (error: unknown) => void;
  /** Called before each automatic restart attempt, with its 1-based number. */
  onRestarting?: (attempt: number, attempts: number) => void;
}

/**
 * Manages the Ruby-based HAML linting server.
 * Maintains a persistent TCP socket connection to a Ruby server process for efficient linting operations.
 */
class LintServer {
  public rubyServerProcess: ChildProcessWithoutNullStreams | null = null;
  private serverPort = 7654;

  private readonly workingDirectory: string;
  private readonly options: () => LintServerOptions;
  private readonly outputChannel: OutputChannel | null = null;
  private readonly deps: LintServerDeps;
  private readonly restartDelaysMs: number[];

  private restartAttempts = 0;
  private restartTimer?: NodeJS.Timeout;
  private handlers: RestartHandlers = {};

  // Per-session secret carried by every request, so no other local process can drive
  // our server over the loopback socket (lib/lint_server/controller.rb#authorized?).
  private readonly token = crypto.randomBytes(32).toString('hex');

  /**
   * @param options - a getter, not values, so a restart picks up a settings change
   *   without anyone having to rebuild this object
   * @param deps - injection points for tests (spawn, restart backoff)
   */
  constructor(
    workingDirectory: string,
    options: () => LintServerOptions,
    outputChannel: OutputChannel | null = null,
    deps: LintServerDeps = {}
  ) {
    this.workingDirectory = workingDirectory;
    this.options = options;
    this.outputChannel = outputChannel;
    this.deps = deps;
    this.restartDelaysMs = deps.restartDelaysMs ?? RESTART_DELAYS_MS;
  }

  /**
   * What to do when the server comes back, and when the automatic attempts run out.
   * Callbacks, so this class stays UI-free.
   */
  public setRestartHandlers(handlers: RestartHandlers): void {
    this.handlers = handlers;
  }

  /** Logs to the output channel, which activation always provides. */
  private printOutput(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(message);
    }
  }

  /** Lints a HAML template and hands the offenses to `callback`. */
  async lint(template: string, filePath: string, configPath: string, callback: CallbackFunc<LinterOffense[]>): Promise<void> {
    const params = {
      action: ACTIONS.lint,
      file_path: filePath,
      template: template,
      config_file: configPath,
      workspace: this.workingDirectory,
    };

    try {
      const data = (await this.serverGet(params)) as ServerResponse<LinterOffense[]>;

      if (data.status !== 'success') {
        const errorMsg = `Linting failed for ${filePath}: ${data.result}`;
        this.printOutput(errorMsg);
        callback([]);
        return;
      }

      callback(data.result);
    } catch (error) {
      const errorMsg = `Error while linting ${filePath}: ${error}`;
      this.printOutput(errorMsg);
      callback([]);
    }
  }

  /**
   * @param options.linters - linter names to restrict the run to; empty runs every one
   * @param options.unsafe - also apply corrections marked unsafe; the default is safe
   * @returns the corrected template, or null when the request failed or timed out
   */
  async autocorrect(
    template: string,
    filePath: string,
    configPath: string,
    options: { linters?: string[]; unsafe?: boolean } = {}
  ): Promise<string | null> {
    const params = {
      action: ACTIONS.autocorrect,
      file_path: filePath,
      template: template,
      config_file: configPath,
      workspace: this.workingDirectory,
      ...(options.linters?.length ? { linters: options.linters } : {}),
      ...(options.unsafe ? { unsafe: true } : {}),
    };

    try {
      // Autocorrect runs on format, so it uses a tight timeout enforced by the
      // transport (which also tears the socket down on timeout).
      const data = (await this.serverGet(params, TIMEOUTS.autocorrectMs)) as ServerResponse<string>;

      if (data.status !== 'success') {
        this.printOutput(`autocorrect error: ${data.result}`);
        return null;
      }

      return data.result;
    } catch (error) {
      this.printOutput(`Error while autocorrecting: ${error}`);
      return null;
    }
  }

  /** Retrieves the list of available haml-lint cops. */
  async listCops(callback: (data: any) => void): Promise<void> {
    const params = {
      action: ACTIONS.listCops,
      workspace: this.workingDirectory,
    };

    try {
      const data = (await this.serverGet(params)) as ServerResponse<any>;

      if (data.status !== 'success') {
        this.printOutput(`Lint error from server: ${data}`);
        callback([]);
        return;
      }

      callback(data.result);
    } catch (error) {
      this.printOutput(`Error while listing cops: ${error}`);
      callback([]);
    }
  }

  /**
   * Starts the Ruby server process (idempotent). {@link startRubyServer} does the spawn
   * and handshake; the process is tracked so a later exit flips the running gate off.
   */
  async start(): Promise<ChildProcessWithoutNullStreams | null> {
    if (this.rubyServerProcess) {
      return this.rubyServerProcess;
    }

    // Read now, not at construction: a settings change only costs a restart.
    const { useBundler, rubyCommand } = this.options();

    let rubyProcess: ChildProcessWithoutNullStreams;
    let port: number;

    try {
      ({ process: rubyProcess, port } = await startRubyServer(
        {
          workingDirectory: this.workingDirectory,
          useBundler,
          token: this.token,
          rubyCommand,
        },
        { log: (message) => this.printOutput(message), spawn: this.deps.spawn }
      ));
    } catch (error) {
      this.handlers.onFailed?.(error);
      throw error;
    }

    this.serverPort = port;
    this.rubyServerProcess = rubyProcess;

    // Dropping the handle stops callers from sending requests, then we try to bring the
    // server back. A handle already cleared by stop/restart means a death we caused.
    const onExit = () => {
      if (this.rubyServerProcess !== rubyProcess) {
        return;
      }

      this.rubyServerProcess = null;
      this.scheduleRestart();
    };
    rubyProcess.on('close', onExit);
    rubyProcess.on('error', onExit);

    this.handlers.onStarted?.();

    return rubyProcess;
  }

  /**
   * Restarts the server on demand (`hamlAll.restartLintServer`), the only thing that
   * resets the automatic-restart counter.
   */
  async restart(): Promise<ChildProcessWithoutNullStreams | null> {
    this.stop();
    this.restartAttempts = 0;

    const rubyProcess = await this.start();
    this.handlers.onRestarted?.();

    return rubyProcess;
  }

  /**
   * Kills the server process and cleans up. Clearing the handle first marks the shutdown
   * as intentional, so the exit does not trigger a restart.
   */
  stop(): void {
    this.cancelRestart();

    if (this.rubyServerProcess) {
      const rubyProcess = this.rubyServerProcess;
      this.rubyServerProcess = null;
      rubyProcess.kill();
    }
  }

  private cancelRestart(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
    }
  }

  // Backs off between attempts: a server dying because `bundle install` is still
  // running should be retried a few seconds later, not hammered.
  private scheduleRestart(): void {
    const delay = this.restartDelaysMs[this.restartAttempts];

    if (delay === undefined) {
      this.printOutput(
        `Haml Lint server died and did not come back after ${this.restartDelaysMs.length} attempts. ` +
          'Run "HAML: Restart lint server" to try again.'
      );
      this.handlers.onGaveUp?.();
      return;
    }

    this.restartAttempts += 1;
    this.handlers.onRestarting?.(this.restartAttempts, this.restartDelaysMs.length);
    this.printOutput(
      `Haml Lint server died; restarting in ${delay}ms (attempt ${this.restartAttempts}/${this.restartDelaysMs.length}).`
    );

    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined;

      this.start()
        .then(() => {
          this.printOutput('Haml Lint server restarted.');
          this.handlers.onRestarted?.();
        })
        .catch((error) => {
          this.printOutput(`Haml Lint server restart failed: ${error}`);
          this.scheduleRestart();
        });
    }, delay);
  }

  /**
   * Sends a request and returns the parsed response. The token is attached here, so the
   * transport stays token-agnostic; the timeout guards against a stuck server.
   */
  private serverGet(params: any, timeoutMs: number = TIMEOUTS.requestMs): Promise<ServerResponse<any>> {
    return sendRequest(
      this.serverPort,
      '127.0.0.1',
      { ...params, token: this.token },
      (message) => this.printOutput(message),
      timeoutMs
    );
  }
}

export default LintServer;
