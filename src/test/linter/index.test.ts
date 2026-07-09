import * as assert from 'assert';
import * as vscode from 'vscode';

import Linter from '../../linter';
import { LinterOffense } from '../../types';

// Minimal document stub good enough for Linter.run() and parseLintOffence(),
// which only touch uri, languageId, getText() and lineAt().
function fakeDocument(uri: vscode.Uri, content = '%div'): vscode.TextDocument {
  return {
    uri,
    languageId: 'haml',
    getText: () => content,
    lineAt: (line: number) => ({
      range: new vscode.Range(line, 0, line, 5),
      firstNonWhitespaceCharacterIndex: 0,
    }),
  } as any;
}

function offense(message: string): LinterOffense {
  return {
    location: { line: 1 },
    severity: 'warning',
    message,
    linter_name: 'LineLength',
  } as any;
}

// A LintServer stand-in whose lint() callbacks we fire manually, so we can
// deliver responses out of order.
function fakeServer() {
  const pending: Array<(data: LinterOffense[]) => void> = [];

  return {
    pending,
    rubyServerProcess: {} as any,
    lint: (_t: string, _f: string, _c: string, cb: (data: LinterOffense[]) => void) => {
      pending.push(cb);
      return Promise.resolve();
    },
  };
}

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

suite('Linter', () => {
  const channel = vscode.window.createOutputChannel('Haml (test)');

  suite('out-of-order responses', () => {
    test('a stale lint response does not overwrite a newer one', async () => {
      const server = fakeServer();
      const linter = new Linter(channel, server as any);
      // Give the document a config path without needing a real workspace folder.
      (linter as any).configFilePath = () => '/tmp/haml-linter-test/.haml-lint.yml';

      const uri = vscode.Uri.file('/tmp/haml-linter-test/stale.haml');
      const document = fakeDocument(uri);

      linter.run(document); // version 1
      linter.run(document); // version 2

      assert.strictEqual(server.pending.length, 2, 'both lint requests should have been sent');

      // Deliver the NEWER response first, then the older/stale one.
      server.pending[1]([offense('newer')]);
      server.pending[0]([offense('older')]);

      const diagnostics = vscode.languages.getDiagnostics(uri);
      assert.strictEqual(diagnostics.length, 1);
      // The parser prefixes the message with the linter name (e.g. "LineLength: newer").
      assert.ok(diagnostics[0].message.includes('newer'), 'the newer response should be applied');
      assert.ok(!diagnostics[0].message.includes('older'), 'the stale response must be discarded');

      linter.dispose();
    });
  });

  suite('lintEnabled', () => {
    test('does not lint and clears diagnostics when disabled', () => {
      const server = fakeServer();
      const linter = new Linter(channel, server as any);
      (linter as any).configFilePath = () => '/tmp/haml-linter-test/.haml-lint.yml';

      const restore = stubHamlAll({ lintEnabled: false });
      const uri = vscode.Uri.file('/tmp/haml-linter-test/disabled.haml');

      try {
        linter.run(fakeDocument(uri));
        assert.strictEqual(server.pending.length, 0, 'no lint request should be sent when disabled');
      } finally {
        restore();
        linter.dispose();
      }
    });

    test('lints when enabled (default)', () => {
      const server = fakeServer();
      const linter = new Linter(channel, server as any);
      (linter as any).configFilePath = () => '/tmp/haml-linter-test/.haml-lint.yml';

      const restore = stubHamlAll({ lintEnabled: true });
      const uri = vscode.Uri.file('/tmp/haml-linter-test/enabled.haml');

      try {
        linter.run(fakeDocument(uri));
        assert.strictEqual(server.pending.length, 1, 'a lint request should be sent when enabled');
      } finally {
        restore();
        linter.dispose();
      }
    });
  });
});
