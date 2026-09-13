import { spawn } from 'node:child_process';
import { OutputChannel, Position, Uri, window, workspace, WorkspaceEdit } from 'vscode';

import { getWorkspaceRoot } from './utils/file';

const CONVERSION_TIMEOUT_MS = 30000;

/**
 * Runs html2haml with the HTML on stdin. Async so Ruby's boot does not block the
 * extension host; argv with no shell, cwd at the root so `bundle exec` finds the Gemfile.
 */
function runHtml2haml(html: string, useBundler: boolean, erb: boolean): Promise<string> {
  const args = ['--ruby19-attributes', '--stdin'];

  if (erb) {
    args.push('--erb');
  }

  const command = useBundler ? 'bundle' : 'html2haml';
  const commandArgs = useBundler ? ['exec', 'html2haml', ...args] : args;

  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: getWorkspaceRoot() || undefined });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`no answer after ${CONVERSION_TIMEOUT_MS / 1000}s`));
    }, CONVERSION_TIMEOUT_MS);

    child.stdout.on('data', (data) => (stdout += data.toString()));
    child.stderr.on('data', (data) => (stderr += data.toString()));

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`exited with code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
    });

    child.stdin.end(html);
  });
}

/** Target file for a converted document: `.html.erb`, `.erb`, `.html` and `.htm` all become `.haml`. */
export function newFilePath(filePath: string): Uri {
  return Uri.file(filePath.replace(/\.(erb|html?)$/, '.haml'));
}

function notAllowedLanguageId(languageId: string | undefined): boolean {
  return ['html', 'erb', 'haml'].includes(String(languageId)) === false;
}

// One message that says what was run and how to fix it; the full detail goes to
// the output channel.
function reportFailure(error: unknown, useBundler: boolean, outputChannel?: OutputChannel): void {
  const label = useBundler ? 'bundle exec html2haml' : 'html2haml';
  const detail = error instanceof Error ? error.message : String(error);
  const install = useBundler
    ? "add `gem 'html2haml'` to your Gemfile and run `bundle install`"
    : 'install it with `gem install html2haml`';

  outputChannel?.appendLine(`html2haml failed (${label}): ${detail}`);

  window
    .showErrorMessage(`\`${label}\` failed: ${detail}. To convert HTML to HAML, ${install}.`, 'Show Output')
    .then((selection) => {
      if (selection === 'Show Output') {
        outputChannel?.show();
      }
    });
}

export async function html2Haml(outputChannel?: OutputChannel): Promise<void> {
  const editor = window.activeTextEditor;
  const languageId = editor?.document.languageId;

  if (!editor || notAllowedLanguageId(languageId)) {
    return;
  }

  // Converting shells out to the project's html2haml (and, with useBundler, to
  // the repository's Gemfile), so it stays off until the workspace is trusted.
  if (!workspace.isTrusted) {
    window.showWarningMessage('Trust the workspace to run html2haml.');
    return;
  }

  const config = workspace.getConfiguration('hamlAll');
  const hasSelection = !editor.selection.isEmpty;
  const html = editor.document.getText(hasSelection ? editor.selection : undefined);

  let haml: string;

  try {
    haml = await runHtml2haml(html, config.useBundler, languageId === 'erb');
  } catch (error) {
    reportFailure(error, config.useBundler, outputChannel);
    return;
  }

  const uri: Uri = hasSelection ? editor.document.uri : newFilePath(editor.document.fileName);
  const edit = new WorkspaceEdit();

  if (hasSelection) {
    edit.replace(uri, editor.selection, haml);
  } else {
    edit.createFile(uri);
    edit.insert(uri, new Position(0, 0), haml);
  }

  await workspace.applyEdit(edit);
  await window.showTextDocument(uri);
}
