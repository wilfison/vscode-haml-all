import * as assert from 'assert';
import * as vscode from 'vscode';

import RoutesCompletionProvider from '../../providers/RoutesCompletionProvider';
import { Route } from '../../rails/router_parser';
import { toPosix } from '../../utils/file';

function route(prefix: string, controller: string, params: string[] = []): Route {
  return {
    prefix,
    controller,
    params,
    verbs: new Set(['GET']),
    actions: new Set(['index']),
    uri: `/${controller}`,
    source_location: 'config/routes.rb:1',
  };
}

function fakeRoutes(routes: Route[]) {
  return { getAll: () => new Map(routes.map((r) => [r.prefix, r])) } as any;
}

function fakeDocument(line: string, file = '/workspace/app/views/users/index.html.haml') {
  return {
    uri: vscode.Uri.file(file),
    getText: () => line,
  } as any;
}

suite('RoutesCompletionProvider Tests', () => {
  // The test host has no workspace folder, so asRelativePath would return the
  // absolute path; mimic a workspace rooted at /workspace.
  const originalAsRelativePath = vscode.workspace.asRelativePath;
  suiteSetup(() => {
    (vscode.workspace as any).asRelativePath = (uri: vscode.Uri) => toPosix(uri.fsPath).replace(/^\/workspace\//, '');
  });
  suiteTeardown(() => {
    (vscode.workspace as any).asRelativePath = originalAsRelativePath;
  });

  const provider = new RoutesCompletionProvider(fakeRoutes([route('posts', 'posts'), route('user', 'users', ['id'])]));

  test('offers nothing on a line without a route-helper trigger word', () => {
    const items = provider.provideCompletionItems(fakeDocument('%p Hello'), new vscode.Position(0, 7));

    assert.strictEqual(items, null);
  });

  test('offers one `<prefix>_path` item per route after `link_to`', () => {
    const items = provider.provideCompletionItems(fakeDocument('= link_to "x", '), new vscode.Position(0, 15)) as vscode.CompletionItem[];

    assert.deepStrictEqual(
      items.map((item) => item.label),
      ['posts_path', 'user_path']
    );
    assert.strictEqual(items[0].kind, vscode.CompletionItemKind.Method);
  });

  test('snippet lets the user pick path/url and fills route params as tab stops', () => {
    const items = provider.provideCompletionItems(fakeDocument('= link_to '), new vscode.Position(0, 10)) as vscode.CompletionItem[];

    assert.strictEqual((items[0].insertText as vscode.SnippetString).value, 'posts_${1|path,url|}');
    assert.strictEqual((items[1].insertText as vscode.SnippetString).value, 'user_${1|path,url|}(${2:id})$0');
  });

  test('preselects the route whose controller matches the current view folder', () => {
    const items = provider.provideCompletionItems(fakeDocument('= link_to '), new vscode.Position(0, 10)) as vscode.CompletionItem[];

    assert.strictEqual(items.find((item) => item.label === 'user_path')?.preselect, true);
    assert.strictEqual(items.find((item) => item.label === 'posts_path')?.preselect, undefined);
  });

  test('only looks at the text before the cursor', () => {
    // `getText(range)` is what the provider inspects; the fake ignores the
    // range, so a line with the trigger after the cursor is simulated by an empty prefix.
    const items = provider.provideCompletionItems(fakeDocument(''), new vscode.Position(0, 0));

    assert.strictEqual(items, null);
  });

  test('returns null when there are no routes', () => {
    const empty = new RoutesCompletionProvider(fakeRoutes([]));

    assert.strictEqual(empty.provideCompletionItems(fakeDocument('= link_to '), new vscode.Position(0, 10)), null);
  });
});
