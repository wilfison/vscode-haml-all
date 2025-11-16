import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

import { Route, parseRoutes } from './router_parser';
import { OutputChannel } from 'vscode';

export default class Routes {
  private routes: Map<string, Route> = new Map();
  private process?: ChildProcessWithoutNullStreams | null = null;

  private rootPath: string = '';
  private outputChanel: OutputChannel | null = null;
  private isARailsProject: boolean = false;

  constructor(rootPath: string, outputChanel: OutputChannel, isARailsProject: boolean) {
    this.rootPath = rootPath;
    this.outputChanel = outputChanel;
    this.isARailsProject = isARailsProject;
  }

  public dispose() {
    this.routes.clear();
  }

  public async load() {
    if (!this.isARailsProject) {
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
        this.outputChanel?.appendLine(`Error: ${data}`);
        reject(data.toString());
      });

      this.process.on('close', () => {
        this.process = null;
        resolve(output);
      });
    });
  }
}
