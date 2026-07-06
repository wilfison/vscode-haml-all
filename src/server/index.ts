import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import net from 'node:net';

import { LinterOffense } from '../types';
import { OutputChannel } from 'vscode';

type CallbackFunc<T> = (data: T) => void;
type ServerResponse<T> = {
  status: string;
  result: T;
};

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
  printOutput(message: string): void {
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
      action: 'lint',
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
      action: 'autocorrect',
      file_path: filePath,
      template: template,
      config_file: configPath,
      workspace: this.workingDirectory,
    };

    try {
      const data = (await Promise.race([
        this.serverGet(params),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
      ])) as ServerResponse<string>;

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
      action: 'list_cops',
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
   * Starts the Ruby server process.
   * Creates a new Ruby process that listens on a TCP socket for linting requests.
   * @returns Promise that resolves to the spawned process or null if already running
   */
  async start(): Promise<ChildProcessWithoutNullStreams | null> {
    if (this.rubyServerProcess) {
      return Promise.resolve(this.rubyServerProcess);
    }

    const libPath = path.join(__dirname, '..', '..', 'lib');
    const args = [`${libPath}/server.rb`, 'start'];

    if (this.useBundler) {
      args.push('--use-bundler');
    }

    return new Promise((resolve, reject) => {
      this.printOutput(`Starting Ruby server with args: ${args.join(' ')}`);

      const rubyProcess = spawn('ruby', args, {
        cwd: this.workingDirectory,
        env: { ...process.env, HAML_LINT_SERVER_TOKEN: this.token },
      });
      this.rubyServerProcess = rubyProcess;

      let stdoutBuffer = '';
      let stderrBuffer = '';
      let settled = false;

      const stderrTail = () => (stderrBuffer.trim() ? ` Last stderr: ${stderrBuffer.trim()}` : '');

      // Settle the start-up promise exactly once and stop watching for the
      // start-up line. The long-lived 'close' handler stays attached so the
      // process is still reaped after a successful start.
      const finish = (settle: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        rubyProcess.stdout.off('data', onStdout);
        settle();
      };

      // The start-up notify may not arrive as a single chunk, so buffer stdout
      // and only parse complete newline-terminated lines. The start-up line is
      // the only stdout line that carries a numeric `port`; a partial or
      // non-JSON line is ignored instead of throwing out of this handler.
      const onStdout = (data: Buffer): void => {
        this.printOutput(`Server output: ${data}`);
        stdoutBuffer += data.toString();

        let newlineIndex = stdoutBuffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex).trim();
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

          if (line) {
            try {
              const response = JSON.parse(line);
              if (typeof response.port === 'number') {
                this.serverPort = response.port;
                finish(() => resolve(rubyProcess));
                return;
              }
            } catch (error: any) {
              this.printOutput(`Ignoring non-JSON server output: ${error.message}`);
            }
          }

          newlineIndex = stdoutBuffer.indexOf('\n');
        }
      };
      rubyProcess.stdout.on('data', onStdout);

      // Ruby/Bundler emit benign warnings to stderr on a healthy start, so
      // collect them for diagnostics instead of failing the launch outright.
      rubyProcess.stderr.on('data', (data) => {
        stderrBuffer += data.toString();
        this.printOutput(`Server stderr: ${data}`);
      });

      // A spawn failure (e.g. `ruby` not on PATH -> ENOENT) is delivered as an
      // event; without this listener Node rethrows it and crashes the host.
      rubyProcess.on('error', (error) => {
        this.rubyServerProcess = null;
        finish(() => reject(new Error(`Failed to spawn Ruby server: ${error.message}`)));
      });

      rubyProcess.on('close', (code) => {
        this.printOutput(`Server process exited with code ${code}`);
        this.rubyServerProcess = null;
        finish(() => reject(new Error(`Ruby server exited with code ${code} before it was ready.${stderrTail()}`)));
      });

      // Fail the launch if the start-up line never arrives.
      const timeout = setTimeout(() => {
        finish(() => reject(new Error(`Timeout starting Ruby server.${stderrTail()}`)));
      }, 10000);
    });
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
   * The server replies with a single JSON line, so it is parsed exactly once here.
   */
  private serverGet(params: any): Promise<ServerResponse<any>> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      this.printOutput(`Server request: ${params.action}`);
      client.connect(this.serverPort, '127.0.0.1', () => {
        const request = JSON.stringify({ ...params, token: this.token });
        client.write(request + '\n');
      });

      let data = '';

      client.on('data', (chunk) => {
        data += chunk.toString();
      });

      client.on('end', () => {
        try {
          const response = JSON.parse(data) as ServerResponse<any>;

          resolve(response);
        } catch (e: any) {
          this.printOutput(`Error parsing server response: ${e.message}`);

          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });

      client.on('error', (err) => {
        reject(err);
      });
    });
  }
}

export default LintServer;
