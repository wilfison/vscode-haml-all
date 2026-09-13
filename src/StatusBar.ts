import { Disposable, StatusBarAlignment, StatusBarItem, ThemeColor, window } from 'vscode';

/**
 * Shows the state of the Ruby lint server while a HAML file is in front of the
 * user. Until now a dead server was only visible as a one-off notification, so a
 * dismissed notice left no trace that linting had stopped.
 *
 * It is shown only for HAML documents: the server is useless to every other
 * language, and the status bar is crowded enough.
 */
export class LintStatusBar implements Disposable {
  private readonly subscription: Disposable;

  constructor(private readonly item: StatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100)) {
    this.item.name = 'HAML lint server';
    this.item.command = 'hamlAll.showOutput';
    this.starting();

    this.subscription = window.onDidChangeActiveTextEditor((editor) => this.showFor(editor?.document.languageId));
    this.showFor(window.activeTextEditor?.document.languageId);
  }

  /** Shows the item for HAML documents and hides it everywhere else. */
  public showFor(languageId?: string): void {
    if (languageId === 'haml') {
      this.item.show();
      return;
    }

    this.item.hide();
  }

  public starting(): void {
    this.set('$(sync~spin) HAML', 'Starting haml-lint server…', false);
  }

  public ok(): void {
    this.set('$(check) HAML', 'haml-lint running', false);
  }

  public warning(reason: string): void {
    this.set('$(warning) HAML', reason, true);
  }

  public dispose(): void {
    this.subscription.dispose();
    this.item.dispose();
  }

  private set(text: string, tooltip: string, warning: boolean): void {
    this.item.text = text;
    // Every state points at the output channel, which carries the detail the
    // tooltip cannot.
    this.item.tooltip = `${tooltip}\nClick to open the "Haml" output.`;
    this.item.backgroundColor = warning ? new ThemeColor('statusBarItem.warningBackground') : undefined;
  }
}
