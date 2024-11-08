import { exec } from 'node:child_process';
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

type Offense = {
  linter_name: string;
  location: {
    line: number;
  };
  message: string;
  severity: string;
};

type File = {
  path: string;
  offenses: Offense[];
};

export const SOURCE = 'haml-lint';

export default class Linter {
  private collection: DiagnosticCollection = languages.createDiagnosticCollection('haml-lint');
  private processes: WeakMap<TextDocument, any> = new WeakMap();

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
    const json = JSON.parse(output) as { files: File[] };
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
      const diagnostic = new Diagnostic(range, offense.message, severity);

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
