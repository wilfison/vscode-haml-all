import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Route, parseRoutes } from './router_parser';
import { OutputChannel } from 'vscode';

import { isPathCommand, railsCommand, splitCommand } from '../Helpers';

/**
 * Manages Rails routes loading and caching.
 * Implements intelligent caching based on routes.rb file modification time.
 */
export default class Routes {
  private routes: Map<string, Route> = new Map();
  private process?: ChildProcessWithoutNullStreams | null = null;

  // Cache management
  private lastLoadTime: number = 0;
  private routesFileLastModified: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
   * Checks if cached routes are still valid.
   * @returns true if cache is valid, false otherwise
   */
  private isCacheValid(): boolean {
    const now = Date.now();
    const cacheAge = now - this.lastLoadTime;

    // Check if cache has expired
    if (cacheAge > this.CACHE_TTL) {
      this.outputChannel?.appendLine('Routes cache expired (TTL exceeded)');
      return false;
    }

    // Check if routes file has been modified
    const routesFilePath = path.join(this.rootPath, 'config', 'routes.rb');
    try {
      if (fs.existsSync(routesFilePath)) {
        const stats = fs.statSync(routesFilePath);
        const currentModTime = stats.mtimeMs;

        if (currentModTime > this.routesFileLastModified) {
          this.outputChannel?.appendLine('Routes cache invalidated (routes.rb modified)');
          return false;
        }
      }
    } catch (error) {
      this.outputChannel?.appendLine(`Error checking routes file: ${error}`);
    }

    return true;
  }

  /**
   * Invalidates the routes cache.
   */
  private invalidateCache(): void {
    this.lastLoadTime = 0;
    this.routesFileLastModified = 0;
  }

  /**
   * Loads routes from Rails application.
   * Uses cached routes if available and valid.
   */
  public async load() {
    if (!this.isARailsProject) {
      return;
    }

    // Return cached routes if still valid
    if (this.routes.size > 0 && this.isCacheValid()) {
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
    this.lastLoadTime = Date.now();
    const routesFilePath = path.join(this.rootPath, 'config', 'routes.rb');
    try {
      if (fs.existsSync(routesFilePath)) {
        const stats = fs.statSync(routesFilePath);
        this.routesFileLastModified = stats.mtimeMs;
      }
    } catch (error) {
      this.outputChannel?.appendLine(`Error updating cache metadata: ${error}`);
    }

    this.outputChannel?.appendLine(`Loaded ${this.routes.size} routes (cached for ${this.CACHE_TTL / 1000}s)`);
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

    // Read the command on every run so a settings change takes effect without a
    // window reload. It may carry arguments ("bundle exec rails"), which go to
    // spawn's argv — never through a shell, since the value comes from settings.
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
   * Only the process that a given run spawned may clear the shared reference —
   * an older process closing after a newer one started would otherwise erase it.
   */
  private clearProcess(child: ChildProcessWithoutNullStreams) {
    if (this.process === child) {
      this.process = null;
    }
  }
}
