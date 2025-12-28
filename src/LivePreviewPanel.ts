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

    this._watchFile();
  }

  async update(hamlContent: string | undefined) {
    if (hamlContent === undefined) {
      return;
    }

    // For now, just display the HAML content
    // TODO: Implement HAML compilation via LSP or another method
    this._panel.webview.html = `
      <html>
        <head>
          <style>
            body { font-family: monospace; padding: 20px; }
            pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h2>HAML Preview (compilation not yet implemented)</h2>
          <pre>${this.escapeHtml(hamlContent)}</pre>
        </body>
      </html>
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.Two;

    if (LivePreviewPanel.currentPanel) {
      LivePreviewPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel('hamlLivePreview', 'Live Preview', column, {
      enableScripts: true,
    });

    LivePreviewPanel.currentPanel = new LivePreviewPanel(panel, extensionUri);
  }

  private _watchFile() {
    let timeoutUpdate: NodeJS.Timeout | undefined = undefined;

    vscode.workspace.onDidChangeTextDocument((event) => {
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
  }
}
