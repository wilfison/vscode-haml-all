import * as vscode from 'vscode';

const ASSET_HELPERS = ['javascript_pack_tag', 'stylesheet_pack_tag', 'javascript_include_tag', 'stylesheet_link_tag'];
const ASSET_HELPERS_MAP = {
  javascript_pack_tag: ['app/javascript/packs'],
  stylesheet_pack_tag: ['app/javascript/packs'],
  javascript_include_tag: ['app/javascript', 'app/assets/javascript'],
  stylesheet_link_tag: ['app/assets/stylesheets'],
};

export default class AssetsDefinitionProvider implements vscode.DefinitionProvider {
  private helperRegex: RegExp = new RegExp(`\\b(${ASSET_HELPERS.join('|')})\\b`);

  public async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    const range = document.getWordRangeAtPosition(position, /\w+/);
    if (!range) {
      return;
    }

    const lineText = document.lineAt(position.line).text;
    const helperMatch = lineText.match(this.helperRegex);
    if (!helperMatch) {
      return;
    }

    const helperName = helperMatch[1] as keyof typeof ASSET_HELPERS_MAP;
    const assetPaths = ASSET_HELPERS_MAP[helperName];
    if (!assetPaths) {
      return;
    }

    const word = document.getWordRangeAtPosition(position, /[\w\/\.-]+/);
    if (!word) {
      return;
    }

    const assetName = document.getText(word).replace(/['"]/g, '');
    const locations: Map<string, vscode.Location> = new Map();

    for (const assetPath of assetPaths) {
      const files = await vscode.workspace.findFiles(`${assetPath}/${assetName}.{ts,js,jsx,tsx,css,scss,sass}`);

      for (const file of files) {
        const location = new vscode.Location(file, new vscode.Position(0, 0));
        locations.set(location.uri.toString(), location);
      }
    }

    return Array.from(locations.values());
  }
}
