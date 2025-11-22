import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
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
      const response = await this.serverGet(params);
      const data = JSON.parse(response) as ServerResponse<LinterOffense[]>;

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
      const response = await Promise.race([
        this.serverGet(params),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
      ]);

      const data = JSON.parse(response) as ServerResponse<string>;

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
      const response = await this.serverGet(params);
      const data = JSON.parse(response) as ServerResponse<any>;

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
   * Compiles a HAML template to HTML.
   * @param template - The HAML template content to compile
   * @param callback - Callback function to receive the compiled HTML or error
   */
  async compileHaml(template: string, callback: (data: any) => void): Promise<void> {
    if (!this.rubyServerProcess) {
      callback({ error: 'Server not started' });

      return;
    }

    const params = {
      action: 'compile',
      workspace: this.workingDirectory,
      template: template,
    };

    try {
      const response = await this.serverGet(params);
      const data = JSON.parse(response) as ServerResponse<any>;

      if (data.status !== 'success') {
        this.printOutput(`Error from server: ${data.result}`);
        callback([]);
        return;
      }

      callback(data.result);
    } catch (error) {
      this.printOutput(`Error while compiling HAML: ${error}`);
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
      this.rubyServerProcess = spawn('ruby', args, { cwd: this.workingDirectory });

      this.rubyServerProcess.stdout.on('data', (data) => {
        this.printOutput(`Server output: ${data}`);

        if (data.toString().includes('Server started')) {
          const response = JSON.parse(data.toString());
          this.serverPort = response.port;

          resolve(this.rubyServerProcess);
        }
      });

      this.rubyServerProcess.stderr.on('data', (data) => {
        reject(`Server error: ${data}`);
      });

      this.rubyServerProcess.on('close', (code) => {
        this.printOutput(`Server process exited with code ${code}`);
        this.rubyServerProcess = null;
      });

      // Timeout for initialization
      setTimeout(() => {
        if (this.rubyServerProcess) {
          resolve(this.rubyServerProcess);
        } else {
          reject(new Error('Timeout starting Ruby server'));
        }
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

  private serverGet(params: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      this.printOutput(`Server request: ${params.action}`);
      client.connect(this.serverPort, '127.0.0.1', () => {
        const request = JSON.stringify(params);
        client.write(request + '\n');
      });

      let data = '';

      client.on('data', (chunk) => {
        data += chunk.toString();
      });

      client.on('end', () => {
        try {
          const response = JSON.parse(data);

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
