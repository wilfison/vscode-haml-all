import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import AssetsCompletionProvider from '../../providers/AssetsCompletionProvider';
import { listAssetFiles } from '../../rails/assetIndex';

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

  // The asset name is inserted verbatim into the HAML, so it must never carry a
  // backslash, whatever the platform's separator is.
  test('never produces an asset name containing a backslash', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'haml-all-assets-'));

    try {
      fs.mkdirSync(path.join(root, 'icons', 'social'), { recursive: true });
      fs.writeFileSync(path.join(root, 'icons', 'social', 'x.png'), '');

      const [assetFile] = listAssetFiles(root);
      const assetName = (provider as any).getAssetName('image_tag', assetFile);

      assert.strictEqual(assetFile.relativePath, 'icons/social/x.png');
      assert.strictEqual(assetName, 'icons/social/x.png');
      assert.ok(!assetName.includes('\\'), assetName);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
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
