import * as vscode from 'vscode';

import { getWorkspaceRoot } from './utils/file';
import { ExtensionActivator } from './ExtensionActivator';
import { LspManager } from './lsp/LspManager';

let lspManager: LspManager | undefined;
let activator: ExtensionActivator | undefined;

let outputChanel = vscode.window.createOutputChannel('Haml');

/**
 * Activates the HAML All-in-One extension.
 * Initializes the LSP manager and configures all extension features.
 * @param context - The VS Code extension context
 */
export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('hamlAll');

  // Initialize LSP Manager
  lspManager = new LspManager(getWorkspaceRoot(), outputChanel, config, context);

  try {
    const client = await lspManager.start();
    outputChanel.appendLine('HAML LSP server started successfully');

    // Register the client for cleanup
    context.subscriptions.push({
      dispose: async () => {
        await lspManager?.dispose();
      },
    });
  } catch (error) {
    outputChanel.appendLine(`Failed to start HAML LSP server: ${error}`);
    vscode.window.showWarningMessage(
      'Failed to start HAML LSP server. Some features may not be available. Check the output for details.'
    );
  }

  activator = new ExtensionActivator(context, outputChanel);
  await activator.activate();
}

/**
 * Deactivates the extension.
 * Stops the LSP manager and cleans up all resources.
 */
export async function deactivate() {
  if (lspManager) {
    await lspManager.dispose();
  }

  if (activator) {
    activator.dispose();
  }

  outputChanel.appendLine('Haml All extension deactivated.');
}
