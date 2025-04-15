import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';

import { LinterOffense } from '../types';

type CallbakFunc<T> = (data: T) => void;
type ServerResponse<T> = {
  status: string;
  result: T;
}

class LintServer {
  public rubyServerProcess: ChildProcessWithoutNullStreams | null = null;
  private serverPort = 7654;

  private readonly workingDirectory: string;
  private readonly useBundler: Boolean;

  constructor(workingDirectory: string, useBundler: Boolean) {
    this.workingDirectory = workingDirectory;
    this.useBundler = useBundler;
  }

  async lint(template: string, filePath: string, configPath: string, callback: CallbakFunc<LinterOffense[]>): Promise<void> {
    const params = {
      action: 'lint',
      file_path: filePath,
      template: template,
      config_file: configPath,
      workspace: this.workingDirectory,
    };

    try {
      const response = await this.serverGet(params) as ServerResponse<LinterOffense[]>;

      if (response.status !== 'success') {
        console.error(`Error from server: ${response.result}`);
        callback([]);
        return;
      }

      callback(response.result);
    } catch (error) {
      console.error(`Error while linting: ${error}`);
      callback([]);
    }
  }

  async autocorrect(template: string, filePath: string, configPath: string): Promise<string> {
    const params = {
      action: 'autocorrect',
      file_path: filePath,
      template: template,
      config_file: configPath,
      workspace: this.workingDirectory,
    };

    try {
      const response = await this.serverGet(params) as ServerResponse<string>;

      if (response.status !== 'success') {
        console.error(`Error from server: ${response.result}`);
        return '';
      }

      return response.result;
    } catch (error) {
      console.error(`Error while autocorrecting: ${error}`);
      return '';
    }
  }

  async listCops(callback: (data: any) => void): Promise<void> {
    const params = {
      action: 'list_cops',
      workspace: this.workingDirectory,
    };

    try {
      const response = await this.serverGet(params) as ServerResponse<any>;

      if (response.status !== 'success') {
        console.error(`Error from server: ${response.result}`);
        callback([]);
        return;
      }

      callback(response.result);
    } catch (error) {
      console.error(`Error while listing cops: ${error}`);
      callback([]);
    }
  }

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
      const response = await this.serverGet(params) as ServerResponse<any>;

      if (response.status !== 'success') {
        console.error(`Error from server: ${response.result}`);
        callback([]);
        return;
      }

      callback(response.result);
    } catch (error) {
      console.error(`Error while compiling HAML: ${error}`);
      callback([]);
    }
  }

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
      console.log(`Starting Ruby server with args: ${args.join(' ')}`);
      this.rubyServerProcess = spawn('ruby', args, { cwd: this.workingDirectory });

      this.rubyServerProcess.stdout.on('data', (data) => {
        console.log(`Server output: ${data}`);

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
        console.log(`Server process exited with code ${code}`);
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

  stop(): void {
    if (this.rubyServerProcess) {
      this.rubyServerProcess.kill();
      this.rubyServerProcess = null;
    }
  }

  private serverGet(params: any): Promise<ServerResponse<any>> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      console.log(`Server request: ${JSON.stringify(params)}`);
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
          console.log(`Server response: ${data}`);
          const response = JSON.parse(data) as ServerResponse<any>;

          if (response.status !== 'success') {
            console.error(`Error from server: ${response.result}`);
            return {};
          }

          resolve(response);
        } catch (e: any) {
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
