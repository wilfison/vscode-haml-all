import { Range, TextDocument, TextEdit, workspace, WorkspaceEdit } from 'vscode';
import Linter from './linter';
import { LinterConfig } from './types';

export async function autoCorrectAll(document: TextDocument, linter: Linter): Promise<void> {
  const text = document.getText();
  const edits: TextEdit[] = [];
  const hamlLintConfig = linter.hamlLintConfig;
  let fixedText = text;

  if (hamlLintConfig) {
    fixedText = await fixWhitespace(fixedText, hamlLintConfig);
  }

  if (fixedText === text) {
    return;
  }

  // Replace the entire document with the fixed text
  const fullRange = new Range(document.positionAt(0), document.positionAt(text.length));
  edits.push(TextEdit.replace(fullRange, fixedText));

  // Apply the edits
  const workspaceEdit = new WorkspaceEdit();
  workspaceEdit.set(document.uri, edits);
  await workspace.applyEdit(workspaceEdit);

  // save the document
  await document.save();
}

async function fixWhitespace(text: string, config: LinterConfig): Promise<string> {
  let fixedText = text;

  // Remove trailing whitespace and multiple blank lines
  if (config.TrailingWhitespace.enabled) {
    fixedText = fixedText
      .split('\n')
      .map(line => line.replace(/\s+$/, ''))
      .join('\n')
      .replace(/\n{2,}/g, '\n\n');
  }

  // Add a blank line at the end if not present
  if (config.FinalNewline.enabled) {
    fixedText = fixedText.endsWith('\n') ? fixedText : fixedText + '\n';
  }

  return fixedText;
}
