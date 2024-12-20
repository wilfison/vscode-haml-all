import { DocumentFormattingEditProvider, FormattingOptions, Range, TextDocument, TextEdit, workspace } from 'vscode';

import Linter from './linter';
import autoCorrectAll from './formatter';

export default class FormattingEditProvider implements DocumentFormattingEditProvider {
  private linter: Linter;

  constructor(linter: Linter) {
    this.linter = linter;
  }

  public provideDocumentFormattingEdits(document: TextDocument, _options: FormattingOptions, _token: any) {
    if (!this.formatEnabled()) {
      return [];
    }

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

  private formatEnabled() {
    return workspace.getConfiguration('hamlAll').get('formatOnSave', false);
  }
}
