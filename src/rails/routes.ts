import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

import { Route, parseRoutes } from './router_parser';
import { fileExists } from '../ultils/file';
import { OutputChannel } from 'vscode';

export default class Routes {
  private routes: Map<string, Route> = new Map();
  private process?: ChildProcessWithoutNullStreams | null = null;

  private rootPath: string = '';
  private outputChanel: OutputChannel | null = null;

  constructor(rootPath: string, outputChanel: OutputChannel) {
    this.rootPath = rootPath;
    this.outputChanel = outputChanel;
  }

  public dispose() {
    this.routes.clear();
  }

  public async load() {
    if (!this.pathIsARailsProject()) {
      return;
    }

    const output = await this.execCmd();

    if (!output) {
      return;
    }

    this.routes.clear();
    this.routes = parseRoutes(output);
    this.outputChanel?.appendLine(`Loaded ${this.routes.size} routes`);
  }

  public getAll() {
    return this.routes;
  }

  public get(controller: string) {
    return this.routes.get(controller);
  }

  private pathIsARailsProject() {
    return fileExists(`${this.rootPath}/bin/rails`);
  }

  private async execCmd() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    const command = 'bin/rails';
    const args = ['routes', '-E'];
    const options = { cwd: this.rootPath };

    return new Promise<string>((resolve, reject) => {
      this.process = spawn(command, args, options);

      let output = '';

      this.process.stdout.on('data', (data) => {
        output += data.toString();
      });

      this.process.stderr.on('data', (data) => {
        console.error(`Error: ${data}`);
        reject(data.toString());
      });

      this.process.on('close', () => {
        this.process = null;
        resolve(output);
      });
    });
  }
}
