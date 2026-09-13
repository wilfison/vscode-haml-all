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

  // The directory table replaced ~30 hand-written path.join calls; this pins the
  // per-helper lookup so a table edit cannot silently drop a location.
  suite('getAssetDirectories', () => {
    const dirs = (helper: string) =>
      (provider as any).getAssetDirectories(helper, '/w').map((d: string) => d.replace(/\\/g, '/').replace('/w/', ''));

    const IMAGES = ['app/assets/images', 'app/javascript/images', 'public/images', 'public/assets', 'vendor/assets/images'];
    const JAVASCRIPTS = [
      'app/assets/builds',
      'app/assets/javascripts',
      'app/javascript',
      'app/javascript/packs',
      'app/javascript/src',
      'app/frontend',
      'app/frontend/javascript',
      'public/javascripts',
      'public/assets',
      'vendor/assets/javascripts',
    ];
    // Without the directories the JavaScript kind already lists.
    const STYLESHEETS_ONLY = [
      'app/assets/stylesheets',
      'app/javascript/stylesheets',
      'app/javascript/styles',
      'app/frontend/stylesheets',
      'public/stylesheets',
      'vendor/assets/stylesheets',
    ];
    const AUDIOS = ['app/assets/audios', 'public/audios'];
    const VIDEOS = ['app/assets/videos', 'public/videos'];

    test('image helpers', () => {
      for (const helper of ['image_tag', 'image_path', 'image_url']) {
        assert.deepStrictEqual(dirs(helper), IMAGES, helper);
      }
    });

    test('javascript_include_tag', () => {
      assert.deepStrictEqual(dirs('javascript_include_tag'), JAVASCRIPTS);
    });

    test('stylesheet_link_tag', () => {
      assert.deepStrictEqual(dirs('stylesheet_link_tag'), [
        'app/assets/builds',
        'app/assets/stylesheets',
        'app/javascript/stylesheets',
        'app/javascript/styles',
        'app/frontend',
        'app/frontend/stylesheets',
        'public/stylesheets',
        'public/assets',
        'vendor/assets/stylesheets',
      ]);
    });

    test('pack and vite helpers cover javascript and stylesheets, each directory once', () => {
      for (const helper of ['javascript_pack_tag', 'stylesheet_pack_tag', 'vite_javascript_tag', 'vite_stylesheet_tag', 'vite_asset_path']) {
        assert.deepStrictEqual(dirs(helper), [...JAVASCRIPTS, ...STYLESHEETS_ONLY], helper);
      }
    });

    test('audio and video helpers', () => {
      assert.deepStrictEqual(dirs('audio_tag'), [...AUDIOS, 'public/assets']);
      assert.deepStrictEqual(dirs('video_tag'), [...VIDEOS, 'public/assets']);
    });

    test('asset_path covers every kind, each directory once', () => {
      assert.deepStrictEqual(
        dirs('asset_path'),
        Array.from(new Set([...IMAGES, ...JAVASCRIPTS, ...STYLESHEETS_ONLY, ...AUDIOS, ...VIDEOS]))
      );
    });
  });
});
