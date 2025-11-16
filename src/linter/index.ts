import path from 'node:path';
import { DiagnosticCollection, languages, TextDocument, workspace, OutputChannel } from 'vscode';

import { LinterConfig, LinterOffense } from '../types';
import { DiagnosticFull, parseLintOffence } from './parser';
import { HAML_LINT_DEFAULT_COPS } from './cops';
import LintServer from '../server';

export const SOURCE = 'haml-lint';

export default class Linter {
  public hamlLintConfig: LinterConfig = HAML_LINT_DEFAULT_COPS;

  private outputChanel: OutputChannel;
  private lintServer: LintServer;
  private collection: DiagnosticCollection = languages.createDiagnosticCollection('haml-lint');

  constructor(outputChanel: OutputChannel, lintServer: LintServer) {
    this.outputChanel = outputChanel;
    this.lintServer = lintServer;
  }

  public dispose() {
    this.collection.dispose();
  }

  public run(document: TextDocument) {
    if (document.uri.scheme !== 'file' || document.languageId !== 'haml') {
      return;
    }

    this.lint(document);
  }

  public clear(document: TextDocument) {
    if (document.uri.scheme !== 'file' || document.languageId !== 'haml') {
      return;
    }

    this.outputChanel.appendLine(`Clearing diagnostics for ${document.uri.scheme}:${document.uri.path}`);
    this.collection.delete(document.uri);
  }

  public clearAll() {
    this.collection.clear();
  }

  public async loadConfigs() {
    this.outputChanel.appendLine('Loading haml-lint config...');

    await this.lintServer.listCops((data: any) => {
      this.hamlLintConfig = { ...this.hamlLintConfig, ...data.haml_lint };
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

  private async lint(document: TextDocument) {
    const configPath = this.configFilePath(document);

    if (!configPath) {
      return;
    }

    if (!this.lintServer.rubyServerProcess) {
      return;
    }

    const filePath = document.uri.fsPath;
    this.outputChanel.appendLine(`Linting ${document.uri.scheme}:${document.uri.path}`);

    await this.lintServer.lint(document.getText(), filePath, configPath, (data: LinterOffense[]) => {
      this.collection.delete(document.uri);

      if (data.length > 0) {
        const diagnostics = this.parse(data, document);
        this.collection.set(document.uri, diagnostics);
      } else {
        this.collection.delete(document.uri);
      }
    });
  }

  private parse(lintOffenses: LinterOffense[], document: TextDocument): DiagnosticFull[] {
    // set unique key for each diagnostic and line
    const offenses = new Map<string, any>();

    lintOffenses.forEach((offense) => {
      const key = `${offense.location.line}:${offense.message}`;
      offenses.set(key, offense);
    });

    const diagnostics: DiagnosticFull[] = [];

    offenses.forEach((offense) => {
      diagnostics.push(parseLintOffence(document, offense));
    });

    return diagnostics;
  }
}
