import * as assert from 'assert';
import * as vscode from 'vscode';

import AssetsDefinitionProvider from '../../providers/AssetsDefinitionProvider';

suite('AssetsDefinitionProvider Tests', () => {
  let provider: AssetsDefinitionProvider;

  setup(() => {
    provider = new AssetsDefinitionProvider();
  });

  test('should return undefined when no word range at position', async () => {
    const document = {
      lineAt: () => ({
        text: '= javascript_include_tag'
      }),
      getWordRangeAtPosition: () => undefined,
      getText: () => ''
    } as any;

    const position = new vscode.Position(0, 0);
    const result = await provider.provideDefinition(document, position);

    assert.strictEqual(result, undefined);
  });

  test('should return undefined when no helper match found', async () => {
    const document = {
      lineAt: () => ({
        text: 'some random text'
      }),
      getWordRangeAtPosition: () => new vscode.Range(0, 0, 0, 4),
      getText: () => 'some'
    } as any;

    const position = new vscode.Position(0, 2);
    const result = await provider.provideDefinition(document, position);

    assert.strictEqual(result, undefined);
  });

  test('should return undefined when helper not in ASSET_HELPERS_MAP', async () => {
    const document = {
      lineAt: () => ({
        text: '= unknown_helper "file"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 16);
        }
        return new vscode.Range(0, 18, 0, 22);
      },
      getText: (range: any) => 'file'
    } as any;

    const position = new vscode.Position(0, 20);
    const result = await provider.provideDefinition(document, position);

    assert.strictEqual(result, undefined);
  });

  test('should return undefined when no word range for asset name', async () => {
    const document = {
      lineAt: () => ({
        text: '= javascript_include_tag'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 24);
        }
        return undefined;
      },
      getText: () => ''
    } as any;

    const position = new vscode.Position(0, 25);
    const result = await provider.provideDefinition(document, position);

    assert.strictEqual(result, undefined);
  });

  test('should find javascript_include_tag assets in correct paths', async () => {
    const mockFiles = [
      vscode.Uri.file('/workspace/app/javascript/application.js'),
      vscode.Uri.file('/workspace/app/assets/javascript/application.js')
    ];

    // Mock vscode.workspace.findFiles
    const originalFindFiles = vscode.workspace.findFiles;
    let findFilesCallCount = 0;
    (vscode.workspace as any).findFiles = async (pattern: string) => {
      findFilesCallCount++;
      if (pattern.includes('app/javascript/application')) {
        return [mockFiles[0]];
      }
      if (pattern.includes('app/assets/javascript/application')) {
        return [mockFiles[1]];
      }
      return [];
    };

    const document = {
      lineAt: () => ({
        text: '= javascript_include_tag "application"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 24);
        }
        return new vscode.Range(0, 26, 0, 37);
      },
      getText: (range: any) => 'application'
    } as any;

    const position = new vscode.Position(0, 30);
    const result = await provider.provideDefinition(document, position) as vscode.Location[];

    // Restore original function
    (vscode.workspace as any).findFiles = originalFindFiles;

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].uri.fsPath, mockFiles[0].fsPath);
    assert.strictEqual(result[1].uri.fsPath, mockFiles[1].fsPath);
    assert.strictEqual(result[0].range.start.line, 0);
    assert.strictEqual(result[0].range.start.character, 0);
  });

  test('should find stylesheet_link_tag assets', async () => {
    const mockFiles = [
      vscode.Uri.file('/workspace/app/assets/stylesheets/application.css')
    ];

    const originalFindFiles = vscode.workspace.findFiles;
    (vscode.workspace as any).findFiles = async (pattern: string) => {
      if (pattern.includes('app/assets/stylesheets/application')) {
        return mockFiles;
      }
      return [];
    };

    const document = {
      lineAt: () => ({
        text: '= stylesheet_link_tag "application"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 21);
        }
        return new vscode.Range(0, 23, 0, 34);
      },
      getText: (range: any) => 'application'
    } as any;

    const position = new vscode.Position(0, 28);
    const result = await provider.provideDefinition(document, position) as vscode.Location[];

    (vscode.workspace as any).findFiles = originalFindFiles;

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].uri.fsPath, mockFiles[0].fsPath);
  });

  test('should find javascript_pack_tag assets', async () => {
    const mockFiles = [
      vscode.Uri.file('/workspace/app/javascript/packs/application.js')
    ];

    const originalFindFiles = vscode.workspace.findFiles;
    (vscode.workspace as any).findFiles = async (pattern: string) => {
      if (pattern.includes('app/javascript/packs/application')) {
        return mockFiles;
      }
      return [];
    };

    const document = {
      lineAt: () => ({
        text: '= javascript_pack_tag "application"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 20);
        }
        return new vscode.Range(0, 22, 0, 33);
      },
      getText: (range: any) => 'application'
    } as any;

    const position = new vscode.Position(0, 27);
    const result = await provider.provideDefinition(document, position) as vscode.Location[];

    (vscode.workspace as any).findFiles = originalFindFiles;

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].uri.fsPath, mockFiles[0].fsPath);
  });

  test('should find stylesheet_pack_tag assets', async () => {
    const mockFiles = [
      vscode.Uri.file('/workspace/app/javascript/packs/application.css')
    ];

    const originalFindFiles = vscode.workspace.findFiles;
    (vscode.workspace as any).findFiles = async (pattern: string) => {
      if (pattern.includes('app/javascript/packs/application')) {
        return mockFiles;
      }
      return [];
    };

    const document = {
      lineAt: () => ({
        text: '= stylesheet_pack_tag "application"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 21);
        }
        return new vscode.Range(0, 23, 0, 34);
      },
      getText: (range: any) => 'application'
    } as any;

    const position = new vscode.Position(0, 28);
    const result = await provider.provideDefinition(document, position) as vscode.Location[];

    (vscode.workspace as any).findFiles = originalFindFiles;

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].uri.fsPath, mockFiles[0].fsPath);
  });

  test('should return empty when no assets found', async () => {
    const originalFindFiles = vscode.workspace.findFiles;
    (vscode.workspace as any).findFiles = async () => [];

    const document = {
      lineAt: () => ({
        text: '= javascript_include_tag "nonexistent"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 24);
        }
        return new vscode.Range(0, 26, 0, 37);
      },
      getText: (range: any) => 'nonexistent'
    } as any;

    const position = new vscode.Position(0, 30);
    const result = await provider.provideDefinition(document, position);

    (vscode.workspace as any).findFiles = originalFindFiles;

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  test('should handle asset names with quotes correctly', async () => {
    const mockFiles = [
      vscode.Uri.file('/workspace/app/javascript/application.js')
    ];

    const originalFindFiles = vscode.workspace.findFiles;
    (vscode.workspace as any).findFiles = async (pattern: string) => {
      // The provider removes quotes, so pattern should not contain them
      assert.ok(!pattern.includes('"'));
      assert.ok(!pattern.includes("'"));
      return pattern.includes('application') ? mockFiles : [];
    };

    const document = {
      lineAt: () => ({
        text: '= javascript_include_tag "application"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 24);
        }
        return new vscode.Range(0, 26, 0, 37);
      },
      getText: (range: any) => '"application"'
    } as any;

    const position = new vscode.Position(0, 30);
    const result = await provider.provideDefinition(document, position) as vscode.Location[];

    (vscode.workspace as any).findFiles = originalFindFiles;

    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  test('should handle asset names with paths', async () => {
    const mockFiles = [
      vscode.Uri.file('/workspace/app/javascript/components/header.js')
    ];

    const originalFindFiles = vscode.workspace.findFiles;
    (vscode.workspace as any).findFiles = async (pattern: string) => {
      return pattern.includes('components/header') ? mockFiles : [];
    };

    const document = {
      lineAt: () => ({
        text: '= javascript_include_tag "components/header"'
      }),
      getWordRangeAtPosition: (pos: any, regex: any) => {
        if (regex.source === '\\w+') {
          return new vscode.Range(0, 2, 0, 24);
        }
        return new vscode.Range(0, 26, 0, 43);
      },
      getText: (range: any) => 'components/header'
    } as any;

    const position = new vscode.Position(0, 35);
    const result = await provider.provideDefinition(document, position) as vscode.Location[];

    (vscode.workspace as any).findFiles = originalFindFiles;

    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].uri.fsPath.includes('components/header'));
  });
});
