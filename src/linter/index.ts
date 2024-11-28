import { exec } from 'node:child_process';
import path from 'node:path';
import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  languages,
  TextDocument,
  workspace,
  Range,
  Position
} from 'vscode';

import { LinterConfig, LinterOutput, RuboCopConfig } from '../types';

export const SOURCE = 'haml-lint';

export default class Linter {
  public hamlLintConfig: LinterConfig | null = null;
  public rubocopConfig: RuboCopConfig | null = null;

  private collection: DiagnosticCollection = languages.createDiagnosticCollection('haml-lint');
  private processes: WeakMap<TextDocument, any> = new WeakMap();

  constructor() {
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
    if (document.uri.scheme === 'file') {
      this.collection.delete(document.uri);
    }
  }

  public clearAll() {
    this.collection.clear();
  }

  public loadConfigs() {
    const libPath = path.join(__dirname, '..', '..', 'lib');
    const command = `ruby ${libPath}/list_cops.rb`;
    const workspaceFolder = workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return;
    }

    exec(command, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        return;
      }

      const cops = JSON.parse(stdout);
      this.hamlLintConfig = cops.haml_lint;
      this.rubocopConfig = cops.rubocop;
      console.log('Lint config loaded');
    });
  }

  private async lint(document: TextDocument) {
    const text = document.getText();
    const oldProcess = this.processes.get(document);
    if (oldProcess) {
      oldProcess.kill();
    }

    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return;
    }

    const command = this.buildCommand(document);

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

  private parse(output: string, document: TextDocument): Diagnostic[] {
    const json = JSON.parse(output) as LinterOutput;
    if (json.files.length < 1) {
      return [];
    }

    return json.files[0].offenses.map(offense => {
      const line = Math.max(offense.location.line - 1, 0);
      const lineText = document.lineAt(line);
      const lineTextRange = lineText.range;

      const range = new Range(
        new Position(lineTextRange.start.line, lineText.firstNonWhitespaceCharacterIndex),
        lineTextRange.end
      );

      const severity = offense.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
      const message = offense.linter_name === 'RuboCop' ? offense.message : `${offense.linter_name}: ${offense.message}`;
      const diagnostic = new Diagnostic(range, message, severity);

      diagnostic.code = offense.linter_name;
      diagnostic.source = SOURCE;

      return diagnostic;
    });
  }

  private buildCommand(document: TextDocument): string {
    const config = workspace.getConfiguration('hamlAll');
    const args = '--parallel --reporter json';

    let linterExecutablePath = config.linterExecutablePath || SOURCE;
    linterExecutablePath = config.useBundler ? 'bundle exec ' : linterExecutablePath;

    return `${linterExecutablePath} ${args} ${document.uri.fsPath}`;
  }
}
