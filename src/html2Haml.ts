import { exec, execSync } from 'node:child_process';
import { Position, Uri, window, workspace, WorkspaceEdit } from 'vscode';

function html2HamlAvailable(useBundler: boolean): boolean {
  const command = useBundler ? 'bundle exec html2haml --version' : 'html2haml --version';

  try {
    exec(command);
    return true;
  } catch (error) {
    window.showErrorMessage(`html2haml not found. Please install html2haml gem to use this extension.\nFail on execute command: ${command}`);
    return false;
  }
}

function runHtml2haml(html: string, useBundler: boolean, erb: boolean): string {
  let command = useBundler ? 'bundle exec html2haml' : 'html2haml';
  let args = ['--ruby19-attributes'];

  if (erb) {
    args.push('--erb');
  }

  const result = execSync(`${command} ${args.join(' ')}`, { input: html });

  return result.toString();
}

function newFilePath(filePath: string): Uri {
  const erb = filePath.endsWith('.erb');
  const regexp = erb ? /\.erb$/ : /\.html$/;

  return Uri.file(filePath.replace(regexp, '.haml'));
}

function notAllowedLanguageId(languageId: string | undefined): boolean {
  return ['html', 'erb'].includes(String(languageId)) === false;
}

export async function html2Haml(): Promise<void> {
  const editor = window.activeTextEditor;
  const languageId = editor?.document.languageId;

  if (!editor || notAllowedLanguageId(languageId)) {
    return;
  }

  const config = workspace.getConfiguration('hamlAll');

  if (!html2HamlAvailable(config.useBundler)) {
    return;
  }

  const html = editor.document.getText();
  const haml = runHtml2haml(html, config.useBundler, languageId === 'erb');

  const uri: Uri = newFilePath(editor.document.fileName);

  const edit = new WorkspaceEdit();
  edit.createFile(uri);
  edit.insert(uri, new Position(0, 0), haml);

  await workspace.applyEdit(edit);
  await window.showTextDocument(uri);
};
