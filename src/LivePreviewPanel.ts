import { execSync } from 'node:child_process';
import path from 'node:path';

import * as vscode from 'vscode';

export default class LivePreviewPanel {
  public static currentPanel: LivePreviewPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    const hamlContent = vscode.window.activeTextEditor?.document.getText();
    this.update(hamlContent);

    this._panel.onDidDispose(() => this.dispose(), null);
  }

  async update(hamlContent: string | undefined) {
    if (hamlContent === undefined) {
      return;
    }

    this._panel.webview.html = await this._getHtmlForWebview(hamlContent || '');
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.Two;

    if (LivePreviewPanel.currentPanel) {
      LivePreviewPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'hamlLivePreview',
      'Live Preview',
      column,
      {
        enableScripts: true,
      }
    );

    LivePreviewPanel.currentPanel = new LivePreviewPanel(panel, extensionUri);
  }

  // transform haml to html
  private async _getHtmlForWebview(hamlContent: string) {
    const libPath = path.join(__dirname, '..', 'lib');
    const command = `ruby ${libPath}/compile.rb`;

    try {
      const result = execSync(command, { input: hamlContent });

      return result.toString();
    }
    catch (error) {
      return String(error);
    }
  }

  public dispose() {
    LivePreviewPanel.currentPanel = undefined;
    this._panel.dispose();

    console.log('dispose LivePreviewPanel');
  }
}