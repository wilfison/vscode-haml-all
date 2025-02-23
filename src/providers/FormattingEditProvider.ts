import {
  DocumentFormattingEditProvider,
  FormattingOptions,
  OutputChannel,
  Range,
  TextDocument,
  TextEdit
} from 'vscode';

import Linter from '../linter';
import autoCorrectAll from '../formatter';

export default class FormattingEditProvider implements DocumentFormattingEditProvider {
  private linter: Linter;
  private outputChanel: OutputChannel;

  constructor(linter: Linter, outputChanel: OutputChannel) {
    this.linter = linter;
    this.outputChanel = outputChanel;
  }

  public provideDocumentFormattingEdits(document: TextDocument, _options: FormattingOptions, _token: any) {
    this.outputChanel.appendLine('Haml All: Formatting document');

    const text = document.getText();
    const edits: TextEdit[] = [];
    const fixedText = autoCorrectAll(text, this.linter);

    if (fixedText === text) {
      return [];
    }

    // Replace the entire document with the fixed text
    const fullRange = new Range(document.positionAt(0), document.positionAt(text.length));
    edits.push(TextEdit.replace(fullRange, fixedText));

    return edits;
  }
}
