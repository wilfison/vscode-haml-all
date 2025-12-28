import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ExtensionContext, OutputChannel, workspace, WorkspaceConfiguration } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

/**
 * Manages the HAML LSP server lifecycle.
 * Handles automatic installation, updates, and execution of the haml_lsp gem in a dedicated folder.
 */
export class LspManager {
  private readonly workspaceRoot: string;
  private readonly lspDir: string;
  private readonly outputChannel: OutputChannel;
  private readonly config: WorkspaceConfiguration;
  private client: LanguageClient | null = null;

  // File paths
  private readonly gitignorePath: string;
  private readonly gemfilePath: string;
  private readonly lastUpdatedPath: string;

  // Update interval: 24 hours in milliseconds
  private readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

  constructor(
    workspaceRoot: string,
    outputChannel: OutputChannel,
    config: WorkspaceConfiguration,
    private context: ExtensionContext
  ) {
    this.workspaceRoot = workspaceRoot;
    this.lspDir = path.join(workspaceRoot, '.haml-lsp');
    this.outputChannel = outputChannel;
    this.config = config;

    this.gitignorePath = path.join(this.lspDir, '.gitignore');
    this.gemfilePath = path.join(this.lspDir, 'Gemfile');
    this.lastUpdatedPath = path.join(this.lspDir, 'last_updated');
  }

  /**
   * Logs a message to the output channel.
   */
  private log(message: string): void {
    this.outputChannel.appendLine(`[LSP Manager] ${message}`);
  }

  /**
   * Creates the .haml-lsp directory if it doesn't exist.
   */
  private ensureLspDirectory(): void {
    if (!existsSync(this.lspDir)) {
      this.log(`Creating .haml-lsp directory at ${this.lspDir}`);
      mkdirSync(this.lspDir, { recursive: true });
    }
  }

  /**
   * Creates or updates the .gitignore file to ignore all contents.
   */
  private ensureGitignore(): void {
    if (!existsSync(this.gitignorePath)) {
      this.log('Creating .gitignore file');
      writeFileSync(this.gitignorePath, '*\n', 'utf8');
    }
  }

  /**
   * Creates or updates the Gemfile that imports the project's Gemfile and adds haml_lsp.
   */
  private ensureGemfile(): void {
    const projectGemfilePath = path.join(this.workspaceRoot, 'Gemfile');
    const hasProjectGemfile = existsSync(projectGemfilePath);

    let gemfileContent = '';

    if (hasProjectGemfile) {
      // Import the project's Gemfile
      gemfileContent += `eval_gemfile(File.expand_path("../Gemfile", __dir__))\n\n`;
    } else {
      // Fallback: create a standalone Gemfile
      gemfileContent += `source "https://rubygems.org"\n\n`;
    }

    gemfileContent += `gem "haml_lsp", require: false, group: :development`;
    const gemLocaltion = this.config.get<string>('lsp_gem_path', '').trim();
    gemfileContent += gemLocaltion ? `, path: "${gemLocaltion}"\n` : `\n`;

    if (!existsSync(this.gemfilePath) || readFileSync(this.gemfilePath, 'utf8') !== gemfileContent) {
      this.log('Creating/updating Gemfile');
      writeFileSync(this.gemfilePath, gemfileContent, 'utf8');
    }

    // Create README to explain the purpose of this directory
    const readmePath = path.join(this.lspDir, 'README.md');
    const readmeContent = `# HAML LSP Directory

This directory is automatically managed by the HAML All-in-One VS Code extension.

## Purpose

- **Gemfile**: Imports your project's Gemfile and adds the haml_lsp gem
- **Gemfile.lock**: Standard bundle lock file
- **last_updated**: Timestamp of the last gem update
- **.gitignore**: Prevents this directory from being committed

## Maintenance

The extension automatically:
- Installs the haml_lsp gem on first activation
- Checks for updates every 24 hours
- Runs \`bundle update haml_lsp\` when needed

**Do not modify files in this directory manually.**

To force a reinstall, delete this directory and reload the VS Code window.
`;

    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, readmeContent, 'utf8');
    }
  }

  /**
   * Checks if the last update was more than 24 hours ago.
   */
  private shouldUpdate(): boolean {
    if (!existsSync(this.lastUpdatedPath)) {
      return true;
    }

    try {
      const lastUpdatedTime = parseInt(readFileSync(this.lastUpdatedPath, 'utf8'), 10);
      const now = Date.now();
      const elapsed = now - lastUpdatedTime;

      this.log(`Last update was ${Math.floor(elapsed / 1000 / 60 / 60)} hours ago`);
      return elapsed > this.UPDATE_INTERVAL;
    } catch (error) {
      this.log(`Error reading last_updated file: ${error}`);
      return true;
    }
  }

  /**
   * Updates the last_updated timestamp.
   */
  private updateTimestamp(): void {
    writeFileSync(this.lastUpdatedPath, Date.now().toString(), 'utf8');
  }

  /**
   * Runs bundle install in the .haml-lsp directory.
   */
  private async runBundleInstall(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log('Running bundle install...');

      const bundleProcess = spawn('bundle', ['install'], {
        cwd: this.lspDir,
        shell: true,
      });

      let output = '';
      let errorOutput = '';

      bundleProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.log(text.trim());
      });

      bundleProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        this.log(`[stderr] ${text.trim()}`);
      });

      bundleProcess.on('close', (code) => {
        if (code === 0) {
          this.log('Bundle install completed successfully');
          this.updateTimestamp();
          resolve();
        } else {
          const error = `Bundle install failed with code ${code}: ${errorOutput}`;
          this.log(error);
          reject(new Error(error));
        }
      });

      bundleProcess.on('error', (error) => {
        this.log(`Failed to start bundle install: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Runs bundle update to update the haml_lsp gem.
   */
  private async runBundleUpdate(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log('Running bundle update haml_lsp...');

      const bundleProcess = spawn('bundle', ['update', 'haml_lsp'], {
        cwd: this.lspDir,
        shell: true,
      });

      let output = '';
      let errorOutput = '';

      bundleProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.log(text.trim());
      });

      bundleProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        this.log(`[stderr] ${text.trim()}`);
      });

      bundleProcess.on('close', (code) => {
        if (code === 0) {
          this.log('Bundle update completed successfully');
          this.updateTimestamp();
          resolve();
        } else {
          const error = `Bundle update failed with code ${code}: ${errorOutput}`;
          this.log(error);
          // Don't reject - we can still use the existing version
          resolve();
        }
      });

      bundleProcess.on('error', (error) => {
        this.log(`Failed to start bundle update: ${error.message}`);
        // Don't reject - we can still use the existing version
        resolve();
      });
    });
  }

  /**
   * Initializes the LSP environment.
   * Creates necessary files and installs/updates the haml_lsp gem.
   */
  async initialize(): Promise<void> {
    this.log('Initializing LSP environment...');

    // Ensure directory and files exist
    this.ensureLspDirectory();
    this.ensureGitignore();
    this.ensureGemfile();

    // Check if we need to install or update
    const gemfileLockPath = path.join(this.lspDir, 'Gemfile.lock');
    const needsInstall = !existsSync(gemfileLockPath);

    if (needsInstall) {
      this.log('Gemfile.lock not found, running initial installation...');
      await this.runBundleInstall();
    } else if (this.shouldUpdate()) {
      this.log('24 hours have passed since last update, updating haml_lsp...');
      await this.runBundleUpdate();
    } else {
      this.log('LSP environment is up to date');
    }
  }

  /**
   * Starts the HAML LSP server.
   */
  async start(): Promise<LanguageClient> {
    await this.initialize();

    const useBundler = this.config.get<boolean>('useBundler', false);
    const enableLint = this.config.get<boolean>('lintEnabled', true);
    const args = ['exec', '--gemfile=.haml-lsp/Gemfile', 'haml_lsp'];

    if (useBundler) {
      args.push('--use-bundle');
    }

    if (enableLint) {
      args.push('--enable-lint');
    }

    this.log(`Starting LSP server with command: bundle ${args.join(' ')}`);

    // Configure server options
    const serverOptions: ServerOptions = {
      command: 'bundle',
      args: args,
      options: {
        cwd: this.workspaceRoot,
        shell: true,
      },
      transport: TransportKind.stdio,
    };

    // Configure client options
    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: 'file', language: 'haml' },
        { scheme: 'untitled', language: 'haml' },
      ],
      outputChannel: this.outputChannel,
      synchronize: {
        fileEvents: workspace.createFileSystemWatcher('**/*.haml'),
      },
    };

    // Create and start the language client
    this.client = new LanguageClient('hamlLsp', 'HAML Language Server', serverOptions, clientOptions);

    // Start the client and the server
    await this.client.start();
    this.log('LSP client started successfully');

    return this.client;
  }

  /**
   * Stops the LSP server if it's running.
   */
  async stop(): Promise<void> {
    if (this.client) {
      this.log('Stopping LSP client...');
      await this.client.stop();
      this.client = null;
    }
  }

  /**
   * Gets the Language Client instance.
   */
  getClient(): LanguageClient | null {
    return this.client;
  }

  /**
   * Disposes of resources.
   */
  async dispose(): Promise<void> {
    await this.stop();
  }
}
