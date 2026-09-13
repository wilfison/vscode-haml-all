import * as assert from 'assert';
import * as vscode from 'vscode';

import { shouldLintOnChange } from '../EventSubscriber';

// Overrides workspace.getConfiguration('hamlAll') to return `values`.
function stubHamlAll(values: Record<string, unknown>): () => void {
  const original = vscode.workspace.getConfiguration;

  (vscode.workspace as any).getConfiguration = (section?: string) => {
    if (section === 'hamlAll') {
      return { get: (key: string, dflt?: unknown) => (key in values ? values[key] : dflt) } as any;
    }
    return (original as any)(section);
  };

  return () => {
    (vscode.workspace as any).getConfiguration = original;
  };
}

suite('shouldLintOnChange', () => {
  test('lints while typing by default', () => {
    const restore = stubHamlAll({});

    try {
      assert.strictEqual(shouldLintOnChange(1, true), true);
    } finally {
      restore();
    }
  });

  test('does not lint while typing when hamlAll.lintOnType is off', () => {
    const restore = stubHamlAll({ lintOnType: false });

    try {
      assert.strictEqual(shouldLintOnChange(1, true), false);
    } finally {
      restore();
    }
  });

  test('ignores a change in a document that is not the active one', () => {
    const restore = stubHamlAll({ lintOnType: true });

    try {
      assert.strictEqual(shouldLintOnChange(1, false), false);
    } finally {
      restore();
    }
  });

  test('ignores an event that carries no content change', () => {
    const restore = stubHamlAll({ lintOnType: true });

    try {
      assert.strictEqual(shouldLintOnChange(0, true), false);
    } finally {
      restore();
    }
  });
});
