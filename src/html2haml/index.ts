import { exec } from 'node:child_process';
import { Position, Uri, window, workspace, WorkspaceEdit } from 'vscode';

import { jsToHaml } from './haml';
import { htmlToJs } from './parser';

export type Html2HamlOptions = {
  erb?: boolean;
  tabSize: number;
  tabChar: HamlTabChar;
};

export enum HamlTabChar {
  Space = ' ',
  Tab = '\t',
}

const defaultOptions: Html2HamlOptions = {
  erb: false,
  tabSize: 2,
  tabChar: HamlTabChar.Space,
};

export async function html2Haml(): Promise<void> {
  const editor = window.activeTextEditor;
  const languageId = editor?.document.languageId;

  if (!editor || notAllowedLanguageId(languageId)) {
    return;
  }

  const config = workspace.getConfiguration('hamlAll');

  if (!html2HamlAvailable(config.useBundler)) {
    window.showErrorMessage('html2haml not found. Please install html2haml gem to use this feature.');

    return;
  }

  const hasSelection = !editor.selection.isEmpty;

  const html = editor.document.getText(hasSelection ? editor.selection : undefined);
  const haml = runHtml2haml(html, { erb: languageId === 'erb' });

  const uri: Uri = hasSelection ? editor.document.uri : newFilePath(editor.document.fileName);
  const edit = new WorkspaceEdit();

  if (hasSelection) {
    edit.replace(uri, editor.selection, haml);
  }
  else {
    edit.createFile(uri);
    edit.insert(uri, new Position(0, 0), haml);
  }

  await workspace.applyEdit(edit);
  await window.showTextDocument(uri);
};


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

function runHtml2haml(html: string, options: Pick<Html2HamlOptions, 'erb'>): string {
  const parserOptions = { ...defaultOptions, ...options } as Html2HamlOptions;
  const htmlJs = htmlToJs(html, parserOptions);

  return jsToHaml(htmlJs, parserOptions);
}

function newFilePath(filePath: string): Uri {
  const erb = filePath.endsWith('.erb');
  const regexp = erb ? /\.erb$/ : /\.html$/;

  return Uri.file(filePath.replace(regexp, '.haml'));
}

function notAllowedLanguageId(languageId: string | undefined): boolean {
  return ['html', 'erb', 'haml'].includes(String(languageId)) === false;
}
