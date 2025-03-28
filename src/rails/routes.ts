import util from 'node:util';
import childProcess, { ChildProcess } from 'node:child_process';

const exec = util.promisify(childProcess.exec);

import { Route, parseRoutes } from './router_parser';
import { fileExists } from '../ultils/file';

export default class Routes {
  private routes: Map<string, Route> = new Map();
  private process?: ChildProcess | null;

  constructor(private rootPath: string) { }

  public dispose() {
    this.routes.clear();
  }

  public async load() {
    if (!this.pathIsARailsProject()) {
      return;
    }

    const output = await this.exec();

    if (!output) {
      return;
    }

    this.routes.clear();
    this.routes = parseRoutes(output);
    console.log('Routes loaded');
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

  private async exec() {
    if (this.process) {
      this.process.kill('SIGTERM');
    }

    const promiseWithChild = exec('bin/rails routes -E', { cwd: this.rootPath });
    this.process = promiseWithChild.child;

    const { stdout, stderr } = await promiseWithChild;
    this.process = null;

    const sanitizedStdout = stdout.slice(stdout.indexOf('--[ Route'));

    if (sanitizedStdout.startsWith('--[ Route')) {
      this.process = null;

      return stdout;
    }

    console.error(`Error loading routes on ${this.rootPath}:\n${stderr || stdout}`);

    return '';
  }
}
