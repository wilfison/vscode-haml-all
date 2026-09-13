import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

import ViewFileDefinitionProvider from '../../providers/ViewFileDefinitionProvider';

function fakeDocument(fileName: string, line: string) {
  return { fileName, lineAt: () => ({ text: line }) } as any;
}

suite('ViewFileDefinitionProvider Tests', () => {
  const provider = new ViewFileDefinitionProvider();
  let tmpDir: string;
  let viewsDir: string;
  let currentView: string;

  suiteSetup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-views-'));
    viewsDir = path.join(tmpDir, 'app', 'views', 'users');
    fs.mkdirSync(viewsDir, { recursive: true });
    fs.writeFileSync(path.join(viewsDir, '_row.html.haml'), '%tr');
    fs.writeFileSync(path.join(viewsDir, '_row.html.erb'), '<tr>');
    currentView = path.join(viewsDir, 'index.html.haml');
  });

  suiteTeardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns nothing when the line has no render call', async () => {
    const result = await provider.provideDefinition(fakeDocument(currentView, '%p "row"'), new vscode.Position(0, 5), null);

    assert.deepStrictEqual(result, []);
  });

  test('returns nothing when the cursor is outside the partial string', async () => {
    const result = await provider.provideDefinition(fakeDocument(currentView, '= render "row"'), new vscode.Position(0, 3), null);

    assert.deepStrictEqual(result, []);
  });

  test('returns nothing when the partial file does not exist', async () => {
    const result = await provider.provideDefinition(fakeDocument(currentView, '= render "nope"'), new vscode.Position(0, 12), null);

    assert.deepStrictEqual(result, []);
  });

  test('links every matching partial file and highlights the string under the cursor', async () => {
    const line = '= render "row", user: user';

    const result = await provider.provideDefinition(fakeDocument(currentView, line), new vscode.Position(0, 11), null);

    assert.deepStrictEqual(
      result.map((link) => path.basename(link.targetUri.fsPath)),
      ['_row.html.haml', '_row.html.erb']
    );
    // Selection covers `row` without the quotes: `= render "` is 10 chars.
    assert.deepStrictEqual(result[0].originSelectionRange, new vscode.Range(0, 10, 0, 13));
    assert.deepStrictEqual(result[0].targetRange, new vscode.Range(0, 0, 0, 0));
  });

  test('resolves the string under the cursor even when other strings come first', async () => {
    const line = "= render partial: 'row', locals: { title: 'x' }";

    const result = await provider.provideDefinition(fakeDocument(currentView, line), new vscode.Position(0, 20), null);

    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0].originSelectionRange, new vscode.Range(0, 19, 0, 22));
  });
});
