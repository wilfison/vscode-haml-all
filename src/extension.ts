import * as vscode from 'vscode';

import { setExtensionRoot } from './utils/extensionRoot';
import { ExtensionActivator } from './ExtensionActivator';

let activator: ExtensionActivator | undefined;

let outputChanel = vscode.window.createOutputChannel('Haml');

/**
 * Activates the HAML All-in-One extension.
 * Registers the editor-only features, and — once the workspace is trusted —
 * the linting server and the rest of the Ruby-backed features.
 * @param context - The VS Code extension context
 */
export async function activate(context: vscode.ExtensionContext) {
  // Capture the install path first: bundled asset lookups (lib/, templates/)
  // resolve against it instead of __dirname. See utils/extensionRoot.
  setExtensionRoot(context.extensionPath);

  activator = new ExtensionActivator(context, outputChanel);
  await activator.activate();
}

/**
 * Deactivates the extension.
 * Stops the linting server and cleans up all resources.
 */
export function deactivate() {
  if (activator) {
    activator.dispose();
  }

  outputChanel.appendLine('Haml All extension deactivated.');
}
