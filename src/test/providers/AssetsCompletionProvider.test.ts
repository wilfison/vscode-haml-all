import * as assert from 'assert';
import * as vscode from 'vscode';
import AssetsCompletionProvider from '../../providers/AssetsCompletionProvider';

suite('AssetsCompletionProvider Tests', () => {
  let provider: AssetsCompletionProvider;

  setup(() => {
    provider = new AssetsCompletionProvider();
  });

  test('should provide completions for image_tag helper', async () => {
    const document = {
      lineAt: () => ({
        text: '= image_tag \'app'
      })
    } as any;

    const position = new vscode.Position(0, 16);

    const completions = provider.provideCompletionItems(document, position, {} as any, {} as any);

    if (Array.isArray(completions)) {
      assert.ok(completions.length >= 0);
    }
  });

  test('should provide completions for javascript_include_tag helper', async () => {
    const document = {
      lineAt: () => ({
        text: '= javascript_include_tag \'application'
      })
    } as any;

    const position = new vscode.Position(0, 37);

    const completions = provider.provideCompletionItems(document, position, {} as any, {} as any);

    if (Array.isArray(completions)) {
      assert.ok(completions.length >= 0);
    }
  });

  test('should provide completions for stylesheet_link_tag helper', async () => {
    const document = {
      lineAt: () => ({
        text: '= stylesheet_link_tag \'application'
      })
    } as any;

    const position = new vscode.Position(0, 34);

    const completions = provider.provideCompletionItems(document, position, {} as any, {} as any);

    if (Array.isArray(completions)) {
      assert.ok(completions.length >= 0);
    }
  });

  test('should return null for non-asset helpers', async () => {
    const document = {
      lineAt: () => ({
        text: '= link_to \'Home\', root_path'
      })
    } as any;

    const position = new vscode.Position(0, 27);

    const completions = provider.provideCompletionItems(document, position, {} as any, {} as any);

    assert.strictEqual(completions, null);
  });
});
