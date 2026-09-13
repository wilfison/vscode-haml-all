import * as assert from 'assert';
import * as vscode from 'vscode';

import { fixSpaceInsideHashLiteralBraces } from '../../quick_fixes/spaceInsideHashLiteralBraces';

async function fixed(content: string, message: string): Promise<[string, string]> {
  const document = await vscode.workspace.openTextDocument({ content, language: 'haml' });
  const range = new vscode.Range(0, 0, 0, content.length);
  const action = fixSpaceInsideHashLiteralBraces(document, new vscode.Diagnostic(range, message));
  const edits = action.edit?.get(document.uri) || [];

  return [action.title, edits.map((edit) => edit.newText).join('')];
}

suite('quick_fixes/spaceInsideHashLiteralBraces Tests', () => {
  test('adds the missing spaces on both sides', async () => {
    const [title, text] = await fixed('%p{class: "a"}', 'Layout/SpaceInsideHashLiteralBraces: Space inside { missing.');

    assert.strictEqual(title, 'Add space inside hash literal braces');
    assert.strictEqual(text, '%p{ class: "a" }');
  });

  test('adds only the space that is missing', async () => {
    const [, text] = await fixed('%p{ class: "a"}', 'Layout/SpaceInsideHashLiteralBraces: Space inside } missing.');

    assert.strictEqual(text, '%p{ class: "a" }');
  });

  test('removes the surrounding spaces when the cop asks for none', async () => {
    const [title, text] = await fixed('%p{ class: "a" }', 'Layout/SpaceInsideHashLiteralBraces: Space inside { detected.');

    assert.strictEqual(title, 'Remove space inside hash literal braces');
    assert.strictEqual(text, '%p{class: "a"}');
  });

  test('produces no edit when the line has no hash', async () => {
    const [, text] = await fixed('%p text', 'Layout/SpaceInsideHashLiteralBraces: Space inside { detected.');

    assert.strictEqual(text, '');
  });
});
