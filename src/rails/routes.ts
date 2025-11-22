import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Route, parseRoutes } from './router_parser';
import { OutputChannel } from 'vscode';

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
    const output = await this.execCmd();

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
        this.outputChannel?.appendLine(`Error: ${data}`);
        reject(data.toString());
      });

      this.process.on('close', () => {
        this.process = null;
        resolve(output);
      });
    });
  }
}
