import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import RoutesDefinitionProvider from '../../providers/RoutesDefinitionProvider';
import { Route } from '../../rails/router_parser';

const USERS: Route = {
  prefix: 'user',
  controller: 'users',
  params: ['id'],
  verbs: new Set(['GET', 'PATCH']),
  actions: new Set(['show', 'update', 'missing']),
  uri: '/users/:id',
  source_location: 'config/routes.rb:1',
};

function fakeRoutes(routes: Route[]) {
  const map = new Map(routes.map((r) => [r.prefix, r]));
  return { get: (prefix: string) => map.get(prefix), getAll: () => map } as any;
}

// `getWordRangeAtPosition` is driven by the real regex, so the fake reports a
// range only when the word under the cursor matches it.
function fakeDocument(line: string, word: string) {
  const start = line.indexOf(word);
  return {
    getWordRangeAtPosition: (_position: vscode.Position, regex: RegExp) =>
      regex.test(word) ? new vscode.Range(0, start, 0, start + word.length) : undefined,
    getText: (range: vscode.Range) => line.slice(range.start.character, range.end.character),
  } as any;
}

suite('RoutesDefinitionProvider Tests', () => {
  const originalFindFiles = vscode.workspace.findFiles;
  let tmpDir: string;
  let controllerUri: vscode.Uri;

  suiteSetup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-routes-'));
    const controllerPath = path.join(tmpDir, 'users_controller.rb');
    fs.writeFileSync(
      controllerPath,
      ['class UsersController < ApplicationController', '  def show', '  end', '', '  def update; end', 'end', ''].join('\n')
    );
    controllerUri = vscode.Uri.file(controllerPath);
  });

  suiteTeardown(() => {
    (vscode.workspace as any).findFiles = originalFindFiles;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns nothing when the cursor is not on a `_path`/`_url` helper', async () => {
    const provider = new RoutesDefinitionProvider(fakeRoutes([USERS]));

    const result = await provider.provideDefinition(fakeDocument('= link_to user', 'user'), new vscode.Position(0, 12));

    assert.strictEqual(result, undefined);
  });

  test('returns nothing for a helper whose prefix is not a known route', async () => {
    const provider = new RoutesDefinitionProvider(fakeRoutes([USERS]));
    let searched = false;
    (vscode.workspace as any).findFiles = async () => {
      searched = true;
      return [];
    };

    const result = await provider.provideDefinition(fakeDocument('= unknown_path', 'unknown_path'), new vscode.Position(0, 5));

    assert.strictEqual(result, undefined);
    assert.strictEqual(searched, false);
  });

  test('returns nothing when the controller file does not exist', async () => {
    const provider = new RoutesDefinitionProvider(fakeRoutes([USERS]));
    let pattern = '';
    (vscode.workspace as any).findFiles = async (glob: string) => {
      pattern = glob;
      return [];
    };

    const result = await provider.provideDefinition(fakeDocument('= user_path(1)', 'user_path'), new vscode.Position(0, 5));

    assert.strictEqual(result, undefined);
    assert.strictEqual(pattern, '**/app/controllers/users_controller.rb');
  });

  test('prefers the app controller over an in-repo engine copy', async () => {
    const provider = new RoutesDefinitionProvider(fakeRoutes([USERS]));
    const engineCopy = vscode.Uri.file('/w/engines/blog/app/controllers/users_controller.rb');
    (vscode.workspace as any).findFiles = async () => [engineCopy, controllerUri];

    const result = (await provider.provideDefinition(fakeDocument('= user_path(1)', 'user_path'), new vscode.Position(0, 5))) as vscode.Location[];

    assert.ok(result.length > 0);
    assert.strictEqual(result[0].uri.fsPath, controllerUri.fsPath);
  });

  test('points at every action the route maps to, skipping actions the controller lacks', async () => {
    const provider = new RoutesDefinitionProvider(fakeRoutes([USERS]));
    (vscode.workspace as any).findFiles = async () => [controllerUri];

    const result = (await provider.provideDefinition(fakeDocument('= user_url(1)', 'user_url'), new vscode.Position(0, 5))) as vscode.Location[];

    assert.deepStrictEqual(
      result.map((location) => [location.uri.fsPath, location.range.start.line]),
      [
        [controllerUri.fsPath, 1],
        [controllerUri.fsPath, 4],
      ]
    );
  });
});
