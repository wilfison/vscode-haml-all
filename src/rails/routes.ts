import util from 'node:util';
import childProcess, { ChildProcess } from 'node:child_process';

const exec = util.promisify(childProcess.exec);

import { Route, parseRoutes } from './router_parser';

export default class Routes {
  private routes: Map<string, Route> = new Map();
  private process?: ChildProcess | null;

  constructor(private rootPath: string) { }

  public dispose() {
    this.routes.clear();
  }

  public async load() {
    const output = await this.exec();

    if (!output) {
      return;
    }

    this.routes.clear();
    this.routes = parseRoutes(output);
  }

  public getAll() {
    return this.routes;
  }

  public get(controller: string) {
    return this.routes.get(controller);
  }

  private async exec() {
    if (this.process) {
      this.process.kill('SIGTERM');
    }

    const promiseWithChild = exec('bin/rails routes -E', { cwd: this.rootPath });
    this.process = promiseWithChild.child;

    const { stdout, stderr } = await promiseWithChild;
    this.process = null;

    if (stdout.startsWith('--[ Route')) {
      this.process = null;

      return stdout;
    }

    console.error(`Error loading routes on ${this.rootPath}:\n${stderr || stdout}`);

    return '';
  }
}
