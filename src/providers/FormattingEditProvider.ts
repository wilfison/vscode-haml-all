import { DocumentFormattingEditProvider, FormattingOptions, OutputChannel, Range, TextDocument, TextEdit } from 'vscode';

import Linter from '../linter';
import autoCorrectAll from '../formatter';
import LintServer from '../server';

export default class FormattingEditProvider implements DocumentFormattingEditProvider {
  private linter: Linter;
  private outputChanel: OutputChannel;
  private lintServer: LintServer;

  constructor(linter: Linter, outputChanel: OutputChannel, lintServer: LintServer) {
    this.linter = linter;
    this.outputChanel = outputChanel;
    this.lintServer = lintServer;
  }

  public async provideDocumentFormattingEdits(document: TextDocument, _options: FormattingOptions, _token: any) {
    this.outputChanel.appendLine('Haml All: Formatting document');

    const text = document.getText();
    const edits: TextEdit[] = [];

    let fixedText = await this.lintServer.autocorrect(text, document.fileName, this.linter.configFilePath(document));
    fixedText = autoCorrectAll(document.fileName, fixedText, this.linter);

    if (fixedText === text) {
      return [];
    }

    // Replace the entire document with the fixed text
    const fullRange = new Range(document.positionAt(0), document.positionAt(text.length));
    edits.push(TextEdit.replace(fullRange, fixedText));

    return edits;
  }
}
