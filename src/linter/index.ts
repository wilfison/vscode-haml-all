import path from 'node:path';
import { DiagnosticCollection, languages, TextDocument, workspace, OutputChannel, window } from 'vscode';

import { LinterOffense } from '../types';
import { DiagnosticFull, parseLintOffence } from './parser';
import LintServer from '../server';

export const SOURCE = 'haml-lint';

export default class Linter {
  /**
   * Whether the installed haml-lint autocorrects its own linters (0.74.0+), or
   * `null` while the server has not answered `list_cops` yet. Formatting uses it
   * only to decide whether to tell the user what their version cannot do.
   */
  public nativeAutocorrect: boolean | null = null;

  /** Version of the haml_lint gem the server is running, once known. */
  public hamlLintVersion: string | null = null;

  private outputChanel: OutputChannel;
  private lintServer: LintServer;
  private collection: DiagnosticCollection = languages.createDiagnosticCollection('haml-lint');

  // Monotonic per-document lint counter. A response is only applied if it is
  // still the latest request for that document, so a slow older lint cannot
  // overwrite the diagnostics of a newer one (see lint()).
  private lintVersions = new Map<string, number>();

  constructor(outputChanel: OutputChannel, lintServer: LintServer) {
    this.outputChanel = outputChanel;
    this.lintServer = lintServer;
  }

  public dispose() {
    this.collection.dispose();
  }

  public isEnabled(): boolean {
    return workspace.getConfiguration('hamlAll').get<boolean>('lintEnabled', true);
  }

  public run(document: TextDocument) {
    if (document.uri.scheme !== 'file' || document.languageId !== 'haml') {
      return;
    }

    // Respect the user's `hamlAll.lintEnabled` setting: when disabled, clear any
    // existing diagnostics for the document and skip the work entirely.
    if (!this.isEnabled()) {
      this.collection.delete(document.uri);
      return;
    }

    this.lint(document);
  }

  public clear(document: TextDocument) {
    if (document.uri.scheme !== 'file' || document.languageId !== 'haml') {
      return;
    }

    this.outputChanel.appendLine(`Clearing diagnostics for ${document.uri.scheme}:${document.uri.path}`);
    // Bump the version so any lint still in flight for this document is dropped
    // instead of re-populating diagnostics we just cleared.
    this.bumpVersion(document.uri.toString());
    this.collection.delete(document.uri);
  }

  public clearAll() {
    this.collection.clear();
  }

  public async loadConfigs() {
    this.outputChanel.appendLine('Loading haml-lint config...');

    await this.lintServer.listCops((data: any) => {
      this.nativeAutocorrect = data.supports_native_autocorrect === true;
      this.hamlLintVersion = typeof data.version === 'string' ? data.version : null;
    });
  }

  public async startServer() {
    try {
      this.outputChanel.appendLine('Starting Haml Lint server...');
      await this.lintServer.start();
      this.outputChanel.appendLine('Haml Lint server started');

      return Promise.resolve();
    } catch (error) {
      this.outputChanel.appendLine(`Error starting Haml Lint server: ${error}`);

      // Surface the failure reason (it carries the server's stderr tail, e.g.
      // the "install it with: gem install haml_lint" hint) instead of a
      // generic message the user cannot act on.
      const reason = error instanceof Error ? error.message : String(error);

      window.showErrorMessage(`Failed to start HAML Lint server. ${reason}`, 'Show Output').then((selection) => {
        if (selection === 'Show Output') {
          this.outputChanel.show();
        }
      });

      return Promise.reject(error);
    }
  }

  public configFilePath(document: TextDocument) {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      return '';
    }

    return path.join(workspaceFolder.uri.fsPath, '.haml-lint.yml');
  }

  private bumpVersion(key: string): number {
    const version = (this.lintVersions.get(key) ?? 0) + 1;
    this.lintVersions.set(key, version);
    return version;
  }

  private async lint(document: TextDocument) {
    const configPath = this.configFilePath(document);

    if (!configPath) {
      return;
    }

    if (!this.lintServer.rubyServerProcess) {
      return;
    }

    const filePath = document.uri.fsPath;
    const key = document.uri.toString();
    const version = this.bumpVersion(key);

    this.outputChanel.appendLine(`Linting ${document.uri.scheme}:${document.uri.path}`);

    await this.lintServer.lint(document.getText(), filePath, configPath, (data: LinterOffense[]) => {
      // A newer lint (or a clear) has superseded this request — drop the stale
      // result so it cannot clobber fresher diagnostics.
      if (this.lintVersions.get(key) !== version) {
        return;
      }

      if (data.length > 0) {
        const diagnostics = this.parse(data, document);
        this.collection.set(document.uri, diagnostics);
      } else {
        this.collection.delete(document.uri);
      }
    });
  }

  private parse(lintOffenses: LinterOffense[], document: TextDocument): DiagnosticFull[] {
    // One diagnostic per (line, linter, message): the same linter can report the
    // same message for a line more than once (e.g. per node), but two linters
    // sharing a message are two findings.
    const offenses = new Map<string, LinterOffense>();

    lintOffenses.forEach((offense) => {
      const key = `${offense.location.line}:${offense.linter_name}:${offense.message}`;
      offenses.set(key, offense);
    });

    const diagnostics: DiagnosticFull[] = [];

    offenses.forEach((offense) => {
      diagnostics.push(parseLintOffence(document, offense));
    });

    return diagnostics;
  }
}
