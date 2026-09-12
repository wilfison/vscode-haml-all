import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import crypto from 'node:crypto';

import { LinterOffense } from '../types';
import { OutputChannel } from 'vscode';

import { ACTIONS, CallbackFunc, ServerResponse, TIMEOUTS } from './protocol';
import { sendRequest } from './transport';
import { startRubyServer } from './processRunner';

/** Backoff before each automatic restart attempt; its length is the attempt cap. */
const RESTART_DELAYS_MS = [1000, 4000, 16000];

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
}

/**
 * Manages the Ruby-based HAML linting server.
 * Maintains a persistent TCP socket connection to a Ruby server process for efficient linting operations.
 */
class LintServer {
  public rubyServerProcess: ChildProcessWithoutNullStreams | null = null;
  private serverPort = 7654;

  private readonly workingDirectory: string;
  private readonly useBundler: Boolean;
  private readonly outputChannel: OutputChannel | null = null;
  private readonly rubyCommand: string;
  private readonly deps: LintServerDeps;
  private readonly restartDelaysMs: number[];

  private restartAttempts = 0;
  private restartTimer?: NodeJS.Timeout;
  private handlers: RestartHandlers = {};

  // Per-session secret shared only with the server process we spawn. Every
  // request carries it so another local process cannot drive our server over
  // the loopback socket. See lib/lint_server/controller.rb#authorized?.
  private readonly token = crypto.randomBytes(32).toString('hex');

  /**
   * Creates a new LintServer instance.
   * @param workingDirectory - The workspace root directory
   * @param useBundler - Whether to use Bundler for gem management
   * @param outputChannel - Optional output channel for logging (defaults to null)
   * @param rubyCommand - Ruby interpreter used to run the server (defaults to `ruby`)
   * @param deps - Injection points for tests (spawn, restart backoff)
   */
  constructor(
    workingDirectory: string,
    useBundler: Boolean,
    outputChannel: OutputChannel | null = null,
    rubyCommand: string = 'ruby',
    deps: LintServerDeps = {}
  ) {
    this.workingDirectory = workingDirectory;
    this.useBundler = useBundler;
    this.outputChannel = outputChannel;
    this.rubyCommand = rubyCommand;
    this.deps = deps;
    this.restartDelaysMs = deps.restartDelaysMs ?? RESTART_DELAYS_MS;
  }

  /**
   * Registers what to do when the server comes back (reload configs, recompute
   * diagnostics) and when the automatic attempts run out (tell the user about the
   * restart command). Kept as callbacks so this class stays UI-free.
   */
  public setRestartHandlers(handlers: RestartHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Logs a message to the output channel.
   * @param message - The message to log
   */
  private printOutput(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(message);
    }
    // Note: If outputChannel is not available, message is silently ignored
    // This should not happen in normal operation as outputChannel is provided during activation
  }

  /**
   * Lints a HAML template and returns offenses via callback.
   * @param template - The HAML template content to lint
   * @param filePath - The file path of the template
   * @param configPath - Path to the haml-lint configuration file
   * @param callback - Callback function to receive linting results
   */
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
   * Attempts to automatically correct linting issues in a HAML template.
   * @param template - The HAML template content to correct
   * @param filePath - The file path of the template
   * @param configPath - Path to the haml-lint configuration file
   * @returns The corrected template, or null when the request failed or timed out
   *   (callers must be able to tell that apart from "nothing to correct")
   */
  async autocorrect(template: string, filePath: string, configPath: string): Promise<string | null> {
    const params = {
      action: ACTIONS.autocorrect,
      file_path: filePath,
      template: template,
      config_file: configPath,
      workspace: this.workingDirectory,
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

  /**
   * Retrieves the list of available haml-lint cops.
   * @param callback - Callback function to receive the list of cops
   */
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
   * Starts the Ruby server process (idempotent).
   * Delegates the spawn + start-up handshake to {@link startRubyServer}, then
   * tracks the process so a later exit flips the "server running" gate off.
   * @returns Promise that resolves to the running process (existing or new)
   */
  async start(): Promise<ChildProcessWithoutNullStreams | null> {
    if (this.rubyServerProcess) {
      return this.rubyServerProcess;
    }

    const { process: rubyProcess, port } = await startRubyServer(
      {
        workingDirectory: this.workingDirectory,
        useBundler: this.useBundler,
        token: this.token,
        rubyCommand: this.rubyCommand,
      },
      { log: (message) => this.printOutput(message), spawn: this.deps.spawn }
    );

    this.serverPort = port;
    this.rubyServerProcess = rubyProcess;

    // Once the server dies, drop our handle so callers stop sending requests
    // (see src/linter/index.ts, which gates linting on rubyServerProcess) and try
    // to bring it back. A process we already let go of (stop/restart cleared the
    // handle) is none of our business: no restart for a death we caused.
    const onExit = () => {
      if (this.rubyServerProcess !== rubyProcess) {
        return;
      }

      this.rubyServerProcess = null;
      this.scheduleRestart();
    };
    rubyProcess.on('close', onExit);
    rubyProcess.on('error', onExit);

    return rubyProcess;
  }

  /**
   * Restarts the server on demand (the `hamlAll.restartLintServer` command).
   * This is the only thing that resets the automatic-restart counter.
   */
  async restart(): Promise<ChildProcessWithoutNullStreams | null> {
    this.stop();
    this.restartAttempts = 0;

    const rubyProcess = await this.start();
    this.handlers.onRestarted?.();

    return rubyProcess;
  }

  /**
   * Stops the Ruby server process.
   * Kills the server process and cleans up resources. Clearing the handle first
   * marks the shutdown as intentional, so the exit does not trigger a restart.
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
   * Sends a request to the Ruby server and returns the parsed response.
   * The token is attached here so every request is authenticated; the socket
   * transport itself is token-agnostic. A per-request timeout guards against a
   * stuck server hanging the caller.
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
