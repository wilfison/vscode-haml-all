import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import Routes from '../../rails/routes';

const ROUTES_OUTPUT = `--[ Route 1 ]---------------------------
Prefix            | users
Verb              | GET
URI               | /users(.:format)
Controller#Action | users#index
Source Location   | config/routes.rb:2
`;

// Counts the runs of `rails routes` without ever spawning it.
function routesWithFakeCommand(rootPath: string): { routes: Routes; runs: number[] } {
  const runs: number[] = [];
  const routes = new Routes(rootPath, null as any, true);

  (routes as any).execCmd = async () => {
    runs.push(Date.now());
    return ROUTES_OUTPUT;
  };

  return { routes, runs };
}

suite('rails/routes Tests', () => {
  let tmpDir: string;
  let routesFile: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-routes-cache-'));
    fs.mkdirSync(path.join(tmpDir, 'config'));
    routesFile = path.join(tmpDir, 'config', 'routes.rb');
    fs.writeFileSync(routesFile, "Rails.application.routes.draw do\n  resources :users\nend\n");
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('reuses the loaded routes while routes.rb is unchanged', async () => {
    const { routes, runs } = routesWithFakeCommand(tmpDir);

    await routes.load();
    await routes.load();

    assert.strictEqual(runs.length, 1);
    assert.strictEqual(routes.getAll().size, 1);
    assert.ok(routes.get('users'));
  });

  test('reloads once routes.rb is touched', async () => {
    const { routes, runs } = routesWithFakeCommand(tmpDir);

    await routes.load();

    const later = new Date(Date.now() + 5000);
    fs.utimesSync(routesFile, later, later);
    await routes.load();

    assert.strictEqual(runs.length, 2);
  });

  test('a forced load ignores the cache, for a change under config/routes/', async () => {
    const { routes, runs } = routesWithFakeCommand(tmpDir);

    await routes.load();
    await routes.load(true);

    assert.strictEqual(runs.length, 2);
  });

  test('loads nothing outside a Rails project', async () => {
    const runs: number[] = [];
    const routes = new Routes(tmpDir, null as any, false);
    (routes as any).execCmd = async () => {
      runs.push(1);
      return ROUTES_OUTPUT;
    };

    await routes.load();

    assert.strictEqual(runs.length, 0);
    assert.strictEqual(routes.getAll().size, 0);
  });

  test('keeps the routes already loaded when the command fails', async () => {
    const { routes } = routesWithFakeCommand(tmpDir);
    const channel = { appendLine: () => undefined };
    (routes as any).outputChannel = channel;

    await routes.load();
    (routes as any).execCmd = async () => {
      throw new Error('bin/rails: not found');
    };

    await routes.load(true);

    assert.strictEqual(routes.getAll().size, 1, 'a failed reload must not wipe the routes');
  });
});

suite('rails/routes disposal', () => {
  test('dispose clears the routes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-routes-dispose-'));

    try {
      const { routes } = routesWithFakeCommand(dir);
      await routes.load();
      assert.strictEqual(routes.getAll().size, 1);

      routes.dispose();

      assert.strictEqual(routes.getAll().size, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Keeps the vscode import meaningful for the test runner's module resolution.
assert.ok(vscode.version);
