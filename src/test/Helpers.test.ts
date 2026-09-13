import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { hamlLintPresent, isARailsProject, resolveRailsCommand } from '../Helpers';
import { splitCommand } from '../utils/command';

// Overrides workspace.getConfiguration so a section returns `values`, through both the
// property access and the inspect() call Helpers.ts uses. Returns a restore function.
function stubConfiguration(section: string, values: Record<string, unknown>): () => void {
  const original = vscode.workspace.getConfiguration;

  const stub = {
    ...values,
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
    inspect: (key: string) => (key in values ? { key, globalValue: values[key] } : undefined),
  };

  (vscode.workspace as any).getConfiguration = (requested?: string) => {
    if (requested === section) {
      return stub as any;
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

    test('skips the global probe when useBundler is on', async () => {
      const restore = stubConfiguration('hamlAll', {
        useBundler: true,
        linterExecutablePath: '/nonexistent/definitely-not-haml-lint',
      });

      try {
        assert.strictEqual(await hamlLintPresent(), true);
      } finally {
        restore();
      }
    });

    test('still probes the executable when useBundler is off', async () => {
      const restore = stubConfiguration('hamlAll', {
        useBundler: false,
        linterExecutablePath: '/nonexistent/definitely-not-haml-lint',
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

      // A shell would run `touch <marker>` here. execFile treats it as one executable
      // name that does not exist, so nothing is written and the probe returns false.
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

  suite('resolveRailsCommand', () => {
    test('prefers hamlAll.railsCommand', () => {
      assert.strictEqual(resolveRailsCommand('bundle exec rails', 'bin/rails'), 'bundle exec rails');
    });

    test('falls back to the deprecated setting, then to the default', () => {
      assert.strictEqual(resolveRailsCommand(undefined, 'bundle exec rails'), 'bundle exec rails');
      assert.strictEqual(resolveRailsCommand('', '   '), 'bin/rails');
      assert.strictEqual(resolveRailsCommand(undefined, undefined), 'bin/rails');
    });
  });

  suite('splitCommand', () => {
    test('splits a command with arguments into argv form', () => {
      assert.deepStrictEqual(splitCommand('bundle exec rails'), ['bundle', 'exec', 'rails']);
      assert.deepStrictEqual(splitCommand('  bin/rails  '), ['bin/rails']);
    });
  });

  suite('isARailsProject', () => {
    test('returns true when the configured rails command exists', () => {
      const restore = stubConfiguration('hamlAll', { railsCommand: nodeBinary });

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

    test('falls back to the deprecated railsRoutes.railsCommand', () => {
      const restore = stubConfiguration('railsRoutes', { railsCommand: nodeBinary });

      try {
        assert.strictEqual(isARailsProject(null), true);
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

      // Rails detection checks the command on disk instead of spawning it, and routes
      // go to spawn in argv form, so a shell metacharacter is never interpreted.
      const payload = `${nodeBinary}; touch ${marker}`;
      const restore = stubConfiguration('railsRoutes', { railsCommand: payload });

      try {
        isARailsProject(null);
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
