import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';

import { LinterOffense } from '../types';

class LintServer {
  private rubyServerProcess: ChildProcessWithoutNullStreams | null = null;
  private serverPort = 7654;

  private readonly workingDirectory: string;
  private readonly useBundler: Boolean;

  constructor(workingDirectory: string, useBundler: Boolean) {
    this.workingDirectory = workingDirectory;
    this.useBundler = useBundler;
  }

  async lint(filePath: string, configPath: string, callback: (data: LinterOffense[]) => void): Promise<void> {
    const params = {
      type: 'lint',
      file_path: filePath,
      config_file: configPath,
      workspace: this.workingDirectory,
    };

    this.serverGet(params, (response: any) => {
      const result = response.result as LinterOffense[];

      if (result.length > 0) {
        callback(result);
      } else {
        callback([]);
      }
    });
  }

  async start(): Promise<ChildProcessWithoutNullStreams> {
    if (this.rubyServerProcess) {
      return Promise.resolve(this.rubyServerProcess);
    }

    const libPath = path.join(__dirname, '..', '..', 'lib');
    const args = [`${libPath}/server.rb`];

    if (this.useBundler) {
      args.push('--use-bundler');
    }

    return new Promise((resolve, reject) => {
      console.log(`Starting Ruby server with args: ${args.join(' ')}`);
      this.rubyServerProcess = spawn('ruby', args, { cwd: this.workingDirectory });

      this.rubyServerProcess.stdout.on('data', (data) => {
        console.log(`Server output: ${data}`);

        if (data.toString().includes('HAML Lint server running')) {
          const response = JSON.parse(data.toString());
          this.serverPort = response.port;

          resolve(this.rubyServerProcess!);
        }
      });

      this.rubyServerProcess.stderr.on('data', (data) => {
        console.error(`Server error: ${data}`);
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
      }, 3000);
    });
  }

  stop(): void {
    if (this.rubyServerProcess) {
      this.rubyServerProcess.kill();
      this.rubyServerProcess = null;
    }
  }

  private serverGet(params: any, callback: (data: any) => void): void {
    const client = new net.Socket();

    client.connect(this.serverPort, '127.0.0.1', () => {
      const request = JSON.stringify(params);
      console.log(`Sending request: ${request}`);
      client.write(request + '\n');
    });

    let data = '';

    client.on('data', (chunk) => {
      data += chunk.toString();
    });

    client.on('end', () => {
      try {
        console.log(`Received data: ${data}`);
        const response = JSON.parse(data);

        if (response.status !== 'success') {
          console.error(`Error from server: ${response.error}`);
          return {};
        }

        callback(response);
      } catch (e: any) {
        Promise.reject(new Error(`Failed to parse response: ${e.message}`));
      }
    });

    client.on('error', (err) => {
      Promise.reject(err);
    });
  }
}

export default LintServer;
