import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'wilfison.haml-all';

suite('Extension Test Suite', () => {
  test('activates and contributes its commands', async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);

    assert.ok(extension, `extension ${EXTENSION_ID} not found`);

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    const contributed = extension.packageJSON.contributes.commands.map((command: any) => command.command);

    assert.ok(contributed.includes('hamlAll.restartLintServer'));

    for (const command of contributed) {
      assert.ok(commands.includes(command), `command ${command} is not registered`);
    }
  });

  // The test host opens no folder, so there is no bin/rails: these features have
  // to be registered outside the Rails-only branch to answer here at all.
  test('data attribute completion works without a Rails project', async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-no-rails-'));
    const file = path.join(dir, 'index.html.haml');
    fs.writeFileSync(file, '%div{data-');

    try {
      const uri = vscode.Uri.file(file);
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));

      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        uri,
        new vscode.Position(0, 10)
      );

      const labels = list.items.map((item) => item.label);
      assert.ok(labels.includes('data-controller'), `no data attributes offered: ${labels.slice(0, 5).join(', ')}`);
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
