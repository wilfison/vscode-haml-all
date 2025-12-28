import { DiagnosticCollection, languages, OutputChannel } from 'vscode';

import { LinterConfig } from '../types';
import { HAML_LINT_DEFAULT_COPS } from './cops';

export const SOURCE = 'haml-lint';

/**
 * @deprecated This class is deprecated. Linting is now provided by the HAML LSP server (haml_lsp gem).
 *
 * The LSP server handles all linting, diagnostics, and quick fixes automatically.
 * Configuration is read from .haml-lint.yml by the LSP server.
 *
 * This class is kept only for backward compatibility and does nothing.
 */
export default class Linter {
  public hamlLintConfig: LinterConfig = HAML_LINT_DEFAULT_COPS;

  private outputChanel: OutputChannel;
  private collection: DiagnosticCollection = languages.createDiagnosticCollection('haml-lint-deprecated');

  constructor(outputChanel: OutputChannel) {
    this.outputChanel = outputChanel;
    this.outputChanel.appendLine('[DEPRECATED] Linter class - All diagnostics now provided by HAML LSP server');
  }

  public dispose() {
    this.collection.dispose();
  }

  public run(_document: any) {
    // No-op: Linting is now handled by the LSP server
  }

  public clear(_document: any) {
    // No-op: Diagnostics managed by LSP
  }

  public clearAll() {
    // No-op: Diagnostics managed by LSP
  }

  public async loadConfigs() {
    // No-op: Config loading handled by LSP server
  }

  public async startServer() {
    // No-op: LSP server handles all linting
    return Promise.resolve();
  }

  public configFilePath(_document: any) {
    // No-op: Config path is now managed by LSP server
    return '';
  }
}
