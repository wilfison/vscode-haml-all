import * as vscode from 'vscode';
import LintServer from './server';

export default class LivePreviewPanel {
  public static currentPanel: LivePreviewPanel | undefined;

  private lintServer: LintServer;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, lintServer: LintServer) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.lintServer = lintServer;

    const hamlContent = vscode.window.activeTextEditor?.document.getText();
    this.update(hamlContent);

    this._panel.onDidDispose(() => this.dispose(), null);

    this._watchFile();
  }

  async update(hamlContent: string | undefined) {
    if (hamlContent === undefined) {
      return;
    }

    await this.lintServer.compileHaml(hamlContent, (result: any) => {
      if (result.error) {
        this._panel.webview.html = `<h1>${result.error}</h1>`;
      } else {
        this._panel.webview.html = result.result;
      }
    });
  }

  public static createOrShow(extensionUri: vscode.Uri, lintServer: LintServer) {
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

    LivePreviewPanel.currentPanel = new LivePreviewPanel(panel, extensionUri, lintServer);
  }

  private _watchFile() {
    let timeoutUpdate: NodeJS.Timeout | undefined = undefined;

    vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.languageId === 'haml' && LivePreviewPanel.currentPanel) {
        if (timeoutUpdate) {
          clearTimeout(timeoutUpdate);
        }
        timeoutUpdate = setTimeout(() => {
          const content = event.document.getText();
          LivePreviewPanel.currentPanel?.update(content);
        }, 500);
      }
    });
  }

  public dispose() {
    LivePreviewPanel.currentPanel = undefined;
    this._panel.dispose();

    console.log('dispose LivePreviewPanel');
  }
}
