import { exec } from 'node:child_process';
import path from 'node:path';
import {
  Diagnostic,
  DiagnosticCollection,
  languages,
  TextDocument,
  workspace,
  OutputChannel
} from 'vscode';

import { LinterConfig, LinterOffense, LinterOutput, RuboCopConfig } from '../types';
import { DiagnosticFull, notifyErrors, parseLintOffence } from './parser';
import { HAML_LINT_DEFAULT_COPS } from './cops';
import LintServer from './server';

export const SOURCE = 'haml-lint';

export default class Linter {
  public hamlLintConfig: LinterConfig = HAML_LINT_DEFAULT_COPS;
  public rubocopConfig: RuboCopConfig | null = null;

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
    if (document.uri.scheme !== 'file' || document.languageId !== 'haml') { return; }

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
    console.log('Loading haml-lint config...');

    await this.lintServer.listCops((data: any) => {
      this.hamlLintConfig = { ...this.hamlLintConfig, ...data.haml_lint };
      this.rubocopConfig = data.rubocop;
    });
  }

  public async startServer() {
    this.outputChanel.appendLine('Starting Haml Lint server...');
    await this.lintServer.start();
    this.outputChanel.appendLine('Haml Lint server started');

    return Promise.resolve();
  }

  private async lint(document: TextDocument) {
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      return;
    }

    const filePath = document.uri.fsPath;
    const configPath = path.join(workspaceFolder.uri.fsPath, '.haml-lint.yml');

    if (!this.lintServer.rubyServerProcess) {
      return;
    }

    await this.lintServer.lint(filePath, configPath, (data: LinterOffense[]) => {
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

    lintOffenses.forEach(offense => {
      const key = `${offense.location.line}:${offense.message}`;
      offenses.set(key, offense);
    });

    const diagnostics: DiagnosticFull[] = [];

    offenses.forEach(offense => {
      diagnostics.push(parseLintOffence(document, offense));
    });

    return diagnostics;
  }
}
