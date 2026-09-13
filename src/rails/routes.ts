import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Route, parseRoutes } from './router_parser';
import { OutputChannel } from 'vscode';

import { railsCommand } from '../Helpers';
import { isPathCommand, splitCommand } from '../utils/command';

/** Loads Rails routes, cached on the modification time of `config/routes.rb`. */
export default class Routes {
  private routes: Map<string, Route> = new Map();
  private process?: ChildProcessWithoutNullStreams | null = null;

  // Cache management: the routes are only re-read when config/routes.rb changes.
  private routesFileLastModified: number = 0;

  private rootPath: string = '';
  private outputChannel: OutputChannel | null = null;
  private isARailsProject: boolean = false;

  constructor(rootPath: string, outputChannel: OutputChannel, isARailsProject: boolean) {
    this.rootPath = rootPath;
    this.outputChannel = outputChannel;
    this.isARailsProject = isARailsProject;
  }

  public dispose() {
    this.routes.clear();
    this.invalidateCache();
  }

  /**
   * Whether the loaded routes still match `config/routes.rb`. No time-based expiry:
   * routes change only when the file does, and the watcher covers `config/routes/**`.
   */
  private isCacheValid(): boolean {
    const routesFilePath = path.join(this.rootPath, 'config', 'routes.rb');

    try {
      if (!fs.existsSync(routesFilePath)) {
        return true;
      }

      if (fs.statSync(routesFilePath).mtimeMs > this.routesFileLastModified) {
        this.outputChannel?.appendLine('Routes cache invalidated (routes.rb modified)');
        return false;
      }
    } catch (error) {
      this.outputChannel?.appendLine(`Error checking routes file: ${error}`);
    }

    return true;
  }

  /** Invalidates the routes cache. */
  private invalidateCache(): void {
    this.routesFileLastModified = 0;
  }

  /**
   * Loads routes, reusing the loaded ones while `config/routes.rb` is unchanged.
   *
   * @param force - reload anyway, as the watcher does for `config/routes/`
   */
  public async load(force = false) {
    if (!this.isARailsProject) {
      return;
    }

    if (!force && this.routes.size > 0 && this.isCacheValid()) {
      this.outputChannel?.appendLine(`Using cached routes (${this.routes.size} routes)`);
      return;
    }

    this.outputChannel?.appendLine('Loading routes from Rails...');

    let output: string;

    try {
      output = await this.execCmd();
    } catch (error) {
      // Keep the routes already loaded: an empty map would silently disable route
      // completions and definitions until the next successful load.
      this.outputChannel?.appendLine(`Could not load routes: ${error instanceof Error ? error.message : error}`);
      return;
    }

    if (!output) {
      return;
    }

    this.routes.clear();
    this.routes = parseRoutes(output);

    // Update cache metadata
    const routesFilePath = path.join(this.rootPath, 'config', 'routes.rb');
    try {
      if (fs.existsSync(routesFilePath)) {
        const stats = fs.statSync(routesFilePath);
        this.routesFileLastModified = stats.mtimeMs;
      }
    } catch (error) {
      this.outputChannel?.appendLine(`Error updating cache metadata: ${error}`);
    }

    this.outputChannel?.appendLine(`Loaded ${this.routes.size} routes`);
  }

  public getAll() {
    return this.routes;
  }

  public get(controller: string) {
    return this.routes.get(controller);
  }

  private async execCmd(): Promise<string> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    // Read on every run, so a settings change needs no window reload. Arguments
    // ("bundle exec rails") go to spawn's argv: the value comes from settings, no shell.
    const [executable, ...commandArgs] = splitCommand(railsCommand());
    const command = isPathCommand(executable) && !path.isAbsolute(executable) ? path.join(this.rootPath, executable) : executable;
    const args = [...commandArgs, 'routes', '-E'];
    const options = { cwd: this.rootPath };
    const label = `${command} ${args.join(' ')}`;

    return new Promise<string>((resolve, reject) => {
      const child = spawn(command, args, options);
      this.process = child;

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Rails writes deprecation warnings and initializer noise to stderr on a
      // perfectly successful run, so stderr is a log, never a failure signal.
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
        this.outputChannel?.appendLine(`rails routes stderr: ${data}`);
      });

      // Without this handler a failing spawn (command missing, not executable)
      // emits an unhandled 'error' event and takes the extension host down.
      child.on('error', (error) => {
        this.clearProcess(child);
        reject(new Error(`Failed to run \`${label}\`: ${error.message}`));
      });

      child.on('close', (code) => {
        this.clearProcess(child);

        if (child.killed) {
          reject(new Error(`\`${label}\` was cancelled by a newer run`));
          return;
        }

        if (code !== 0) {
          reject(new Error(`\`${label}\` exited with code ${code}. ${errorOutput.trim().slice(-500)}`));
          return;
        }

        resolve(output);
      });
    });
  }

  /**
   * Only the process a given run spawned may clear the shared reference, or an older
   * process closing after a newer one started would erase it.
   */
  private clearProcess(child: ChildProcessWithoutNullStreams) {
    if (this.process === child) {
      this.process = null;
    }
  }
}
