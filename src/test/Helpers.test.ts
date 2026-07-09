import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { hamlLintPresent, isARailsProject } from '../Helpers';

// Overrides workspace.getConfiguration so that a given config section returns
// `values` (property access, matching how Helpers.ts reads the settings).
// Returns a restore function.
function stubConfiguration(section: string, values: Record<string, unknown>): () => void {
  const original = vscode.workspace.getConfiguration;

  (vscode.workspace as any).getConfiguration = (requested?: string) => {
    if (requested === section) {
      return values as any;
    }
    return (original as any)(requested);
  };

  return () => {
    (vscode.workspace as any).getConfiguration = original;
  };
}

suite('Helpers Tests', () => {
  // A resolvable executable that accepts `--version` on every platform running
  // these tests: the Node binary itself.
  const nodeBinary = process.execPath;

  suite('hamlLintPresent', () => {
    test('returns true when the configured executable exists', async () => {
      const restore = stubConfiguration('hamlAll', { linterExecutablePath: nodeBinary });

      try {
        assert.strictEqual(await hamlLintPresent(), true);
      } finally {
        restore();
      }
    });

    test('returns false when the configured executable is missing', async () => {
      const restore = stubConfiguration('hamlAll', {
        linterExecutablePath: '/nonexistent/definitely-not-haml-lint'
      });

      try {
        assert.strictEqual(await hamlLintPresent(), false);
      } finally {
        restore();
      }
    });

    test('does not run shell metacharacters from the executable path (no command injection)', async () => {
      const marker = path.join(os.tmpdir(), 'haml-all-injection-marker-lint.txt');

      // Clean any leftover from a previous run so the assertion is meaningful.
      try {
        fs.rmSync(marker, { force: true });
      } catch (e) {
        // ignore
      }

      // With exec()/a shell this would run `touch <marker>`. With execFile
      // (argv form) it is treated as a single executable name that does not
      // exist, so nothing is written and the probe simply returns false.
      const payload = `${nodeBinary}; touch ${marker}`;
      const restore = stubConfiguration('hamlAll', { linterExecutablePath: payload });

      try {
        assert.strictEqual(await hamlLintPresent(), false);
        assert.strictEqual(fs.existsSync(marker), false, 'injected command must not have executed');
      } finally {
        restore();
        try {
          fs.rmSync(marker, { force: true });
        } catch (e) {
          // ignore
        }
      }
    });
  });

  suite('isARailsProject', () => {
    test('returns true when the configured rails command exists', () => {
      const restore = stubConfiguration('railsRoutes', { railsCommand: nodeBinary });

      try {
        assert.strictEqual(isARailsProject(null), true);
      } finally {
        restore();
      }
    });

    test('returns false when the configured rails command is missing', () => {
      const restore = stubConfiguration('railsRoutes', {
        railsCommand: '/nonexistent/definitely-not-rails'
      });

      try {
        assert.strictEqual(isARailsProject(null), false);
      } finally {
        restore();
      }
    });

    test('does not run shell metacharacters from the rails command (no command injection)', () => {
      const marker = path.join(os.tmpdir(), 'haml-all-injection-marker-rails.txt');

      try {
        fs.rmSync(marker, { force: true });
      } catch (e) {
        // ignore
      }

      // Rails detection now checks the command on disk (existsSync) instead of
      // spawning it, so the payload is treated as a single (nonexistent) path
      // and nothing is ever executed.
      const payload = `${nodeBinary}; touch ${marker}`;
      const restore = stubConfiguration('railsRoutes', { railsCommand: payload });

      try {
        assert.strictEqual(isARailsProject(null), false);
        assert.strictEqual(fs.existsSync(marker), false, 'injected command must not have executed');
      } finally {
        restore();
        try {
          fs.rmSync(marker, { force: true });
        } catch (e) {
          // ignore
        }
      }
    });
  });
});
