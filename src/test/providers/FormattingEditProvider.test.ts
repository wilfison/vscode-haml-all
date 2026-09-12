import * as assert from 'assert';
import * as vscode from 'vscode';

import FormattingEditProvider, { FIX_ALL_KIND } from '../../providers/FormattingEditProvider';

// Enough of a Linter for the provider: the enable gate, the config path and the
// legacy-formatter switch (off, so the server's answer is used verbatim).
function fakeLinter(enabled = true): any {
  return {
    isEnabled: () => enabled,
    configFilePath: () => '/ws/.haml-lint.yml',
    legacyAutocorrectNeeded: () => false,
  };
}

// Returns the queued results in order; `null` stands for a failed/timed-out
// autocorrect, a string for a successful one.
function fakeLintServer(results: (string | null)[]): any {
  const server: any = {
    calls: 0,
    autocorrect: async () => {
      server.calls += 1;
      return results.shift() ?? null;
    },
  };
  return server;
}

function fakeOutputChannel(): any {
  return { appendLine: () => {}, show: () => {} };
}

// Counts the warning notifications the provider raises.
function countWarnings(): { count: () => number; restore: () => void } {
  const original = vscode.window.showWarningMessage;
  let calls = 0;

  (vscode.window as any).showWarningMessage = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('HAML formatting timed out')) {
      calls += 1;
    }
    return Promise.resolve(undefined);
  };

  return {
    count: () => calls,
    restore: () => {
      (vscode.window as any).showWarningMessage = original;
    },
  };
}

async function hamlDocument(content = '%p Hello'): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ content, language: 'haml' });
}

suite('FormattingEditProvider Tests', () => {
  test('returns no edits and does not throw when autocorrect fails', async () => {
    const document = await hamlDocument();
    const warnings = countWarnings();
    const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer([null]));

    try {
      const edits = await provider.provideDocumentFormattingEdits(document, {} as any, null);

      assert.deepStrictEqual(edits, []);
      assert.strictEqual(warnings.count(), 1);
    } finally {
      warnings.restore();
    }
  });

  test('warns at most once per session for consecutive failures', async () => {
    const document = await hamlDocument();
    const warnings = countWarnings();
    const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer([null, null]));

    try {
      await provider.provideDocumentFormattingEdits(document, {} as any, null);
      await provider.provideDocumentFormattingEdits(document, {} as any, null);

      assert.strictEqual(warnings.count(), 1);
    } finally {
      warnings.restore();
    }
  });

  test('rearms the warning after a successful format', async () => {
    const document = await hamlDocument();
    const warnings = countWarnings();
    const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer([null, '%p Fixed', null]));

    try {
      await provider.provideDocumentFormattingEdits(document, {} as any, null);
      await provider.provideDocumentFormattingEdits(document, {} as any, null);
      await provider.provideDocumentFormattingEdits(document, {} as any, null);

      assert.strictEqual(warnings.count(), 2);
    } finally {
      warnings.restore();
    }
  });

  test('does not call the server when linting is disabled', async () => {
    const document = await hamlDocument();
    const lintServer = fakeLintServer(['%p Fixed']);
    const provider = new FormattingEditProvider(fakeLinter(false), fakeOutputChannel(), lintServer);

    const edits = await provider.provideDocumentFormattingEdits(document, {} as any, null);

    assert.deepStrictEqual(edits, []);
    assert.strictEqual(lintServer.calls, 0);
  });

  test('cancels the pending lint before asking the server to format', async () => {
    const document = await hamlDocument();
    let cancelled = 0;
    const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer(['%p Fixed']), () => {
      cancelled += 1;
    });

    const edits = await provider.provideDocumentFormattingEdits(document, {} as any, null);

    assert.strictEqual(cancelled, 1);
    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].newText, '%p Fixed');
  });

  test('surfaces a rejected autocorrect as a failed format', async () => {
    const document = await hamlDocument();
    const warnings = countWarnings();
    const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), {
      autocorrect: async () => {
        throw new Error('socket hung up');
      },
    } as any);

    try {
      const edits = await provider.provideDocumentFormattingEdits(document, {} as any, null);

      assert.deepStrictEqual(edits, []);
      assert.strictEqual(warnings.count(), 1);
    } finally {
      warnings.restore();
    }
  });

  suite('source.fixAll.hamlLint', () => {
    function context(only?: vscode.CodeActionKind): vscode.CodeActionContext {
      return { diagnostics: [], only, triggerKind: vscode.CodeActionTriggerKind.Invoke };
    }

    const range = new vscode.Range(0, 0, 0, 0);
    const cancelled = { isCancellationRequested: true, onCancellationRequested: () => ({ dispose() {} }) } as any;
    const live = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) } as any;

    test('is not offered for the lightbulb (no `only`)', async () => {
      const document = await hamlDocument();
      const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer(['%p Fixed']));

      assert.deepStrictEqual(provider.provideCodeActions(document, range, context(undefined)), []);
      assert.deepStrictEqual(provider.provideCodeActions(document, range, context(vscode.CodeActionKind.QuickFix)), []);
    });

    test('offers one lazy action for source.fixAll and for source.fixAll.hamlLint', async () => {
      const document = await hamlDocument();
      const lintServer = fakeLintServer(['%p Fixed']);
      const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), lintServer);

      for (const only of [vscode.CodeActionKind.SourceFixAll, FIX_ALL_KIND]) {
        const actions = provider.provideCodeActions(document, range, context(only));

        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].title, 'Fix all auto-correctable haml-lint offenses');
        assert.strictEqual(actions[0].kind?.value, 'source.fixAll.hamlLint');
        assert.strictEqual(actions[0].edit, undefined);
      }

      assert.strictEqual(lintServer.calls, 0);
    });

    test('resolves to a full-document replace when the server changes the text', async () => {
      const document = await hamlDocument();
      const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer(['%p Fixed']));
      const [action] = provider.provideCodeActions(document, range, context(FIX_ALL_KIND));

      const resolved = await provider.resolveCodeAction(action as any, live);

      const edits = resolved.edit?.get(document.uri) || [];
      assert.strictEqual(edits.length, 1);
      assert.strictEqual(edits[0].newText, '%p Fixed');
      assert.ok(edits[0].range.isEqual(new vscode.Range(0, 0, 0, '%p Hello'.length)));
    });

    test('resolves without an edit and warns once when the server fails', async () => {
      const document = await hamlDocument();
      const warnings = countWarnings();
      const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer([null]));
      const [action] = provider.provideCodeActions(document, range, context(FIX_ALL_KIND));

      try {
        const resolved = await provider.resolveCodeAction(action as any, live);

        assert.strictEqual(resolved.edit, undefined);
        assert.strictEqual(warnings.count(), 1);
      } finally {
        warnings.restore();
      }
    });

    test('a cancelled token yields no edit and no warning', async () => {
      const document = await hamlDocument();
      const warnings = countWarnings();
      const provider = new FormattingEditProvider(fakeLinter(), fakeOutputChannel(), fakeLintServer([null]));
      const [action] = provider.provideCodeActions(document, range, context(FIX_ALL_KIND));

      try {
        const resolved = await provider.resolveCodeAction(action as any, cancelled);

        assert.strictEqual(resolved.edit, undefined);
        assert.strictEqual(warnings.count(), 0);
      } finally {
        warnings.restore();
      }
    });

    test('is not offered when linting is disabled', async () => {
      const document = await hamlDocument();
      const lintServer = fakeLintServer(['%p Fixed']);
      const provider = new FormattingEditProvider(fakeLinter(false), fakeOutputChannel(), lintServer);

      assert.deepStrictEqual(provider.provideCodeActions(document, range, context(FIX_ALL_KIND)), []);
      assert.strictEqual(lintServer.calls, 0);
    });
  });
});
