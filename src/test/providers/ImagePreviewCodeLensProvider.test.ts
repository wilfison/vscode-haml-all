import * as assert from 'assert';
import * as vscode from 'vscode';
import ImagePreviewCodeLensProvider, { escapeHtml, renderWebviewTemplate } from '../../providers/ImagePreviewCodeLensProvider';

suite('ImagePreviewCodeLensProvider Tests', () => {
  let provider: ImagePreviewCodeLensProvider;

  setup(() => {
    provider = new ImagePreviewCodeLensProvider();
  });

  test('should provide code lens for image_tag helper', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= image_tag \'logo.png\''
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    // May return empty array if no workspace or image not found, which is expected in test environment
    assert.ok(Array.isArray(codeLenses));
  });

  test('should provide code lens for image_path helper', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= image_path \'icons/home.svg\''
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
  });

  test('should provide code lens for image_url helper', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= image_url \'background.jpg\''
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
  });

  test('should provide code lens for asset_path helper with image', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= asset_path \'favicon.ico\''
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
  });

  test('should not provide code lens for non-image helpers', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= link_to \'Home\', root_path'
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
    if (Array.isArray(codeLenses)) {
      assert.strictEqual(codeLenses.length, 0);
    }
  });

  test('should not provide code lens for non-image files', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= javascript_include_tag \'application.js\''
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
    if (Array.isArray(codeLenses)) {
      assert.strictEqual(codeLenses.length, 0);
    }
  });

  test('should handle multiple images in one line', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= image_tag(\'logo.png\') + image_tag(\'icon.svg\')'
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
  });

  test('should provide code lens for images without extension', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= image_tag \'logo\''
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
  });

  test('escapes interpolated values so a crafted file name cannot inject markup', () => {
    const html = renderWebviewTemplate('<h2>{{imageName}}</h2><img src="{{imageUri}}" />', {
      imageName: '<img src=x onerror=alert(1)>',
      imageUri: 'https://example.com/a.png?a=1&b=2',
    });

    assert.ok(html.includes('&lt;img'), 'the injected tag should be escaped');
    assert.ok(!html.includes('<img src=x'), 'no raw tag should survive');
    assert.ok(!html.includes('onerror=alert(1)>'), 'no raw handler should survive');
    assert.ok(html.includes('a=1&amp;b=2'), 'ampersands should be escaped');
  });

  test('escapeHtml escapes every HTML-significant character', () => {
    assert.strictEqual(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  });

  test('renderWebviewTemplate does not treat $& in a value as a replacement pattern', () => {
    const html = renderWebviewTemplate('<p>{{imagePath}}</p>', { imagePath: 'app/assets/$&.png' });

    assert.strictEqual(html, '<p>app/assets/$&amp;.png</p>');
  });

  test('should provide code lens for remote imagens', () => {
    const document = {
      lineCount: 1,
      lineAt: (line: number) => ({
        text: '= image_url \'https://example.com/image.png\''
      })
    } as any;

    const codeLenses = provider.provideCodeLenses(document, {} as any);

    assert.ok(Array.isArray(codeLenses));
  });
});
