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

import { LinterConfig, LinterOutput, RuboCopConfig } from '../types';
import { DiagnosticFull, parseLintOffence } from './parser';

export const SOURCE = 'haml-lint';

export default class Linter {
  public hamlLintConfig: LinterConfig | null = null;
  public rubocopConfig: RuboCopConfig | null = null;

  private outputChanel: OutputChannel;
  private collection: DiagnosticCollection = languages.createDiagnosticCollection('haml-lint');
  private processes: WeakMap<TextDocument, any> = new WeakMap();

  constructor(outputChanel: OutputChannel) {
    this.outputChanel = outputChanel;

    this.loadConfigs();
  }

  public dispose() {
    this.collection.dispose();
  }

  public run(document: TextDocument) {
    if (document.languageId !== 'haml') { return; }

    this.lint(document);
  }

  public clear(document: TextDocument) {
    if (document.uri.scheme !== 'file') {
      return;
    }

    this.outputChanel.appendLine(`Clearing diagnostics for ${document.uri.scheme}:${document.uri.path}`);
    this.collection.delete(document.uri);
  }

  public clearAll() {
    this.collection.clear();
  }

  public loadConfigs() {
    const libPath = path.join(__dirname, '..', '..', 'lib');
    const workspaceFolder = workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return;
    }

    const workingDirectory = workspaceFolder.uri.fsPath;
    const command = `ruby ${libPath}/list_cops.rb ${workingDirectory}`;
    console.log(`Running: ${command}`);

    exec(command, {}, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        return;
      }

      const cops = JSON.parse(stdout);
      this.hamlLintConfig = cops.haml_lint;
      this.rubocopConfig = cops.rubocop;

      this.outputChanel.appendLine('Loaded Haml-Lint config:');
      this.outputChanel.appendLine(JSON.stringify(this.hamlLintConfig));
      this.outputChanel.appendLine('Loaded RuboCop config:');
      this.outputChanel.appendLine(JSON.stringify(this.rubocopConfig));
    });
  }

  private async lint(document: TextDocument) {
    const oldProcess = this.processes.get(document);

    if (oldProcess) {
      oldProcess.kill();
    }

    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

    if (!workspaceFolder) {
      return;
    }

    const command = this.buildCommand(document);
    const text = document.getText();

    this.outputChanel.appendLine(`Running: ${command}`);
    const process = exec(command, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
      this.processes.delete(document);

      // NOTE: The document may have been modified since the lint was triggered.
      if (text !== document.getText()) { return; }

      this.collection.delete(document.uri);
      if (!error) {
        return;
      }

      if (error.code === 1 && stderr.length > 0) {
        console.error(stderr);
        return;
      }

      this.collection.set(document.uri, this.parse(stdout, document));
    });

    this.processes.set(document, process);
  }

  private parse(output: string, document: TextDocument): DiagnosticFull[] {
    const json = JSON.parse(output) as LinterOutput;
    if (json.files.length < 1) {
      return [];
    }

    // set unique key for each diagnostic and line
    const offenses = new Map<string, any>();

    json.files[0].offenses.forEach(offense => {
      const key = `${offense.location.line}:${offense.message}`;
      console.log(key);
      offenses.set(key, offense);
    });

    const diagnostics: DiagnosticFull[] = [];

    offenses.forEach(offense => {
      diagnostics.push(parseLintOffence(document, offense));
    });

    return diagnostics;
  }

  private buildCommand(document: TextDocument): string {
    const config = workspace.getConfiguration('hamlAll');
    const args = '--parallel --reporter json';

    let linterExecutablePath = config.linterExecutablePath || SOURCE;

    if (config.useBundler) {
      linterExecutablePath = `bundle exec ${SOURCE}`;
    }

    return `${linterExecutablePath} ${args} ${document.uri.fsPath}`;
  }
}
