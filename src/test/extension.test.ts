import * as assert from 'assert';
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
});
