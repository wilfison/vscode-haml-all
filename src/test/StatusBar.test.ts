import * as assert from 'assert';
import * as vscode from 'vscode';

import { LintStatusBar } from '../StatusBar';

// A StatusBarItem stand-in that records what the status bar sets on it.
function fakeItem() {
  return {
    name: '',
    text: '',
    tooltip: '',
    command: '',
    backgroundColor: undefined as vscode.ThemeColor | undefined,
    shown: 0,
    hidden: 0,
    disposed: 0,
    show() {
      this.shown += 1;
    },
    hide() {
      this.hidden += 1;
    },
    dispose() {
      this.disposed += 1;
    },
  };
}

suite('LintStatusBar Tests', () => {
  test('opens the output channel when clicked', () => {
    const item = fakeItem();
    const statusBar = new LintStatusBar(item as any);

    try {
      assert.strictEqual(item.command, 'hamlAll.showOutput');
      assert.strictEqual(item.name, 'HAML lint server');
    } finally {
      statusBar.dispose();
    }
  });

  test('starts in the "starting" state', () => {
    const item = fakeItem();
    const statusBar = new LintStatusBar(item as any);

    try {
      assert.strictEqual(item.text, '$(sync~spin) HAML');
      assert.ok(item.tooltip.startsWith('Starting haml-lint server'));
      assert.strictEqual(item.backgroundColor, undefined);
    } finally {
      statusBar.dispose();
    }
  });

  test('ok clears the warning background', () => {
    const item = fakeItem();
    const statusBar = new LintStatusBar(item as any);

    try {
      statusBar.warning('it died');
      statusBar.ok();

      assert.strictEqual(item.text, '$(check) HAML');
      assert.strictEqual(item.backgroundColor, undefined);
    } finally {
      statusBar.dispose();
    }
  });

  test('warning shows the reason and the warning background', () => {
    const item = fakeItem();
    const statusBar = new LintStatusBar(item as any);

    try {
      statusBar.warning('haml-lint not found.');

      assert.strictEqual(item.text, '$(warning) HAML');
      assert.ok(item.tooltip.startsWith('haml-lint not found.'));
      assert.ok(item.tooltip.includes('Click to open'));
      assert.deepStrictEqual(item.backgroundColor, new vscode.ThemeColor('statusBarItem.warningBackground'));
    } finally {
      statusBar.dispose();
    }
  });

  test('is shown for HAML documents only', () => {
    const item = fakeItem();
    const statusBar = new LintStatusBar(item as any);

    try {
      const shownBefore = item.shown;
      statusBar.showFor('haml');
      assert.strictEqual(item.shown, shownBefore + 1);

      const hiddenBefore = item.hidden;
      statusBar.showFor('ruby');
      statusBar.showFor(undefined);
      assert.strictEqual(item.hidden, hiddenBefore + 2);
    } finally {
      statusBar.dispose();
    }
  });

  test('dispose releases the item', () => {
    const item = fakeItem();

    new LintStatusBar(item as any).dispose();

    assert.strictEqual(item.disposed, 1);
  });
});
