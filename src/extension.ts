import * as vscode from 'vscode';

import { hamlLintPresent } from './Helpers';
import { getWorkspaceRoot } from './ultils/file';
import { ExtensionActivator } from './ExtensionActivator';
import LintServer from './server';

let lintServer: LintServer = new LintServer(getWorkspaceRoot(), false);
let activator: ExtensionActivator | undefined;

let outputChanel = vscode.window.createOutputChannel('Haml');

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('hamlAll');

  lintServer = new LintServer(getWorkspaceRoot(), config.useBundler, outputChanel);

  if (!hamlLintPresent()) {
    vscode.window.showErrorMessage('haml-lint not found. Please install haml-lint gem to use this extension.');
  }

  activator = new ExtensionActivator(context, outputChanel, lintServer);
  await activator.activate();
}

export function deactivate() {
  if (lintServer) {
    lintServer.stop();
  }

  if (activator) {
    activator.dispose();
  }

  outputChanel.appendLine('Haml All extension deactivated.');
}
