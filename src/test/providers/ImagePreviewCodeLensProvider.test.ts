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

  // Only the helper's own argument is a candidate. Everything else on the line
  // (alt:, class:, a route helper) used to be probed against the disk.
  suite('image references', () => {
    // Records every name the provider tries to resolve, and resolves none.
    function spyingProvider(): { provider: ImagePreviewCodeLensProvider; probed: string[] } {
      const probed: string[] = [];
      const provider = new ImagePreviewCodeLensProvider();
      (provider as any).findImagePath = (imageName: string) => {
        probed.push(imageName);
        return null;
      };

      return { provider, probed };
    }

    function probe(text: string): string[] {
      const { provider, probed } = spyingProvider();
      const document = { lineCount: 1, lineAt: () => ({ text }) } as any;

      provider.provideCodeLenses(document, {} as any);

      return probed;
    }

    test('ignores the other quoted options on an image_tag line', () => {
      assert.deepStrictEqual(probe('= image_tag "logo.png", alt: "Company logo"'), ['logo.png']);
    });

    test('offers nothing when the image comes from a variable', () => {
      assert.deepStrictEqual(probe('= image_tag user.avatar, class: "round"'), []);
    });

    test('finds the argument of a nested image_tag', () => {
      assert.deepStrictEqual(probe('= link_to image_tag("icon"), root_path'), ['icon']);
    });

    test('keeps one candidate per helper call on the line', () => {
      assert.deepStrictEqual(probe("= image_tag('logo.png') + image_tag('icon.svg')"), ['logo.png', 'icon.svg']);
    });

    test('ignores a quoted string on a line with no image helper', () => {
      assert.deepStrictEqual(probe('= link_to "Home", root_path'), []);
    });

    test('the range covers the name without its quotes', () => {
      const { provider } = spyingProvider();
      (provider as any).findImagePath = (name: string) => `/w/app/assets/images/${name}`;
      const text = '= image_tag "logo.png", alt: "x"';
      const document = { lineCount: 1, lineAt: () => ({ text }) } as any;

      const lenses = provider.provideCodeLenses(document, {} as any) as vscode.CodeLens[];

      assert.strictEqual(lenses.length, 1);
      assert.deepStrictEqual(lenses[0].range, new vscode.Range(0, 13, 0, 21));
      assert.strictEqual(text.slice(13, 21), 'logo.png');
    });
  });
});
