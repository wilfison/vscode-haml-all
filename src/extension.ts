import * as vscode from 'vscode';

import { hamlLintPresent } from './Helpers';
import { getWorkspaceRoot } from './utils/file';
import { ExtensionActivator } from './ExtensionActivator';
import LintServer from './server';

let lintServer: LintServer = new LintServer(getWorkspaceRoot(), false);
let activator: ExtensionActivator | undefined;

let outputChanel = vscode.window.createOutputChannel('Haml');

/**
 * Activates the HAML All-in-One extension.
 * Initializes the linting server, checks for haml-lint installation,
 * and sets up all extension features.
 * @param context - The VS Code extension context
 */
export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('hamlAll');

  lintServer = new LintServer(getWorkspaceRoot(), config.useBundler, outputChanel);

  if (!hamlLintPresent()) {
    vscode.window.showErrorMessage('haml-lint not found. Please install haml-lint gem to use this extension.');
  }

  activator = new ExtensionActivator(context, outputChanel, lintServer);
  await activator.activate();
}

/**
 * Deactivates the extension.
 * Stops the linting server and cleans up all resources.
 */
export function deactivate() {
  if (lintServer) {
    lintServer.stop();
  }

  if (activator) {
    activator.dispose();
  }

  outputChanel.appendLine('Haml All extension deactivated.');
}
