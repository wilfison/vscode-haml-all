import { ChildProcessWithoutNullStreams } from 'node:child_process';
import crypto from 'node:crypto';

import { LinterOffense } from '../types';
import { OutputChannel } from 'vscode';

import { ACTIONS, CallbackFunc, ServerResponse, TIMEOUTS } from './protocol';
import { sendRequest } from './transport';
import { startRubyServer } from './processRunner';

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

  // Per-session secret shared only with the server process we spawn. Every
  // request carries it so another local process cannot drive our server over
  // the loopback socket. See lib/lint_server/controller.rb#authorized?.
  private readonly token = crypto.randomBytes(32).toString('hex');

  /**
   * Creates a new LintServer instance.
   * @param workingDirectory - The workspace root directory
   * @param useBundler - Whether to use Bundler for gem management
   * @param outputChannel - Optional output channel for logging (defaults to null)
   */
  constructor(workingDirectory: string, useBundler: Boolean, outputChannel: OutputChannel | null = null) {
    this.workingDirectory = workingDirectory;
    this.useBundler = useBundler;
    this.outputChannel = outputChannel;
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
   * @returns The corrected template content, or original template if correction fails
   */
  async autocorrect(template: string, filePath: string, configPath: string): Promise<string> {
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
        return template;
      }

      return data.result;
    } catch (error) {
      this.printOutput(`Error while autocorrecting: ${error}`);
      return template;
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
      },
      { log: (message) => this.printOutput(message) }
    );

    this.serverPort = port;
    this.rubyServerProcess = rubyProcess;

    // Once the server dies, drop our handle so callers stop sending requests
    // (see src/linter/index.ts, which gates linting on rubyServerProcess).
    const clearHandle = () => {
      this.rubyServerProcess = null;
    };
    rubyProcess.on('close', clearHandle);
    rubyProcess.on('error', clearHandle);

    return rubyProcess;
  }

  /**
   * Stops the Ruby server process.
   * Kills the server process and cleans up resources.
   */
  stop(): void {
    if (this.rubyServerProcess) {
      this.rubyServerProcess.kill();
      this.rubyServerProcess = null;
    }
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
