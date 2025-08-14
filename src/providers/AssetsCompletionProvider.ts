import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export default class AssetsCompletionProvider implements vscode.CompletionItemProvider {
  private assetHelpers = [
    'asset_path',
    'image_path',
    'image_url',
    'javascript_pack_tag',
    'stylesheet_pack_tag',
    'javascript_include_tag',
    'stylesheet_link_tag',
    'image_tag',
    'audio_tag',
    'video_tag',
    'vite_javascript_tag',
    'vite_stylesheet_tag',
    'vite_asset_path'
  ];

  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const line = document.lineAt(position.line).text;
    const linePrefix = line.substring(0, position.character);

    const assetContext = this.getAssetContext(linePrefix);
    if (!assetContext) {
      return null;
    }

    return this.getAssetCompletions(assetContext.helper, assetContext.prefix);
  }

  private getAssetContext(linePrefix: string): { helper: string; prefix: string } | null {
    for (const helper of this.assetHelpers) {
      const patterns = [
        new RegExp(`=\\s*${helper}\\s*\\(?\\s*['"](.*?)$`),
        new RegExp(`=\\s*${helper}\\s*\\(?\\s*([^'"][^,\\)\\s]*?)$`),
        new RegExp(`=\\s*${helper}\\s*\\(\\s*['"](.*?)$`),
        new RegExp(`\\b${helper}\\s*\\(?\\s*['"](.*?)$`),
        new RegExp('\\{\\s*[\'\"](.*?)$')
      ];

      for (const pattern of patterns) {
        const match = linePrefix.match(pattern);
        if (match && linePrefix.includes(helper)) {
          return {
            helper,
            prefix: match[1] || ''
          };
        }
      }
    }

    return null;
  }

  private getAssetCompletions(helper: string, prefix: string): vscode.CompletionItem[] {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const assetPaths = this.getAssetPaths(helper, workspaceFolder.uri.fsPath);
    const completions: vscode.CompletionItem[] = [];

    for (const assetPath of assetPaths) {
      const assetName = this.getAssetName(helper, assetPath);

      if (assetName.startsWith(prefix)) {
        const completion = new vscode.CompletionItem(assetName, vscode.CompletionItemKind.File);
        completion.detail = this.getAssetDetail(helper, assetPath);
        completion.insertText = assetName;
        completion.sortText = assetName;
        completion.documentation = new vscode.MarkdownString(`**File:** \`${assetPath}\``);
        completions.push(completion);
      }
    }

    return completions;
  }

  private getAssetName(helper: string, assetPath: string): string {
    if (helper.includes('javascript') || helper.includes('stylesheet') || helper.includes('vite')) {
      return path.basename(assetPath, path.extname(assetPath));
    }
    return assetPath;
  }

  private getAssetPaths(helper: string, workspacePath: string): string[] {
    const assetDirectories = this.getAssetDirectories(helper, workspacePath);
    const assets: string[] = [];

    for (const dir of assetDirectories) {
      if (fs.existsSync(dir)) {
        assets.push(...this.scanDirectory(dir, this.getAssetExtensions(helper)));
      }
    }

    return assets;
  }

  private getAssetDirectories(helper: string, workspacePath: string): string[] {
    const directories: string[] = [];

    if (helper.includes('image') || helper === 'asset_path') {
      directories.push(
        path.join(workspacePath, 'app', 'assets', 'images'),
        path.join(workspacePath, 'app', 'javascript', 'images'),
        path.join(workspacePath, 'public', 'images'),
        path.join(workspacePath, 'public', 'assets'),
        path.join(workspacePath, 'vendor', 'assets', 'images')
      );
    }

    if (helper.includes('javascript') || helper.includes('pack') || helper.includes('vite') || helper === 'asset_path') {
      directories.push(
        path.join(workspacePath, 'app', 'assets', 'builds'),
        path.join(workspacePath, 'app', 'assets', 'javascripts'),
        path.join(workspacePath, 'app', 'javascript'),
        path.join(workspacePath, 'app', 'javascript', 'packs'),
        path.join(workspacePath, 'app', 'javascript', 'src'),
        path.join(workspacePath, 'app', 'frontend'),
        path.join(workspacePath, 'app', 'frontend', 'javascript'),
        path.join(workspacePath, 'public', 'javascripts'),
        path.join(workspacePath, 'public', 'assets'),
        path.join(workspacePath, 'vendor', 'assets', 'javascripts')
      );
    }

    if (helper.includes('stylesheet') || helper.includes('pack') || helper.includes('vite') || helper === 'asset_path') {
      directories.push(
        path.join(workspacePath, 'app', 'assets', 'builds'),
        path.join(workspacePath, 'app', 'assets', 'stylesheets'),
        path.join(workspacePath, 'app', 'javascript', 'stylesheets'),
        path.join(workspacePath, 'app', 'javascript', 'styles'),
        path.join(workspacePath, 'app', 'frontend'),
        path.join(workspacePath, 'app', 'frontend', 'stylesheets'),
        path.join(workspacePath, 'public', 'stylesheets'),
        path.join(workspacePath, 'public', 'assets'),
        path.join(workspacePath, 'vendor', 'assets', 'stylesheets')
      );
    }

    if (helper.includes('audio') || helper === 'asset_path') {
      directories.push(
        path.join(workspacePath, 'app', 'assets', 'audios'),
        path.join(workspacePath, 'public', 'audios'),
        path.join(workspacePath, 'public', 'assets')
      );
    }

    if (helper.includes('video') || helper === 'asset_path') {
      directories.push(
        path.join(workspacePath, 'app', 'assets', 'videos'),
        path.join(workspacePath, 'public', 'videos'),
        path.join(workspacePath, 'public', 'assets')
      );
    }

    return directories;
  }

  private getAssetExtensions(helper: string): string[] {
    if (helper.includes('image')) {
      return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
    }

    if (helper.includes('javascript') || helper.includes('vite')) {
      return ['.js', '.coffee', '.ts', '.jsx', '.tsx', '.mjs', '.es6'];
    }

    if (helper.includes('stylesheet') || helper.includes('vite')) {
      return ['.css', '.scss', '.sass', '.less', '.stylus'];
    }

    if (helper.includes('audio')) {
      return ['.mp3', '.wav', '.ogg', '.m4a'];
    }

    if (helper.includes('video')) {
      return ['.mp4', '.webm', '.ogv', '.avi'];
    }

    return [];
  }

  private scanDirectory(directory: string, extensions: string[]): string[] {
    const assets: string[] = [];

    try {
      const items = fs.readdirSync(directory, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(directory, item.name);

        if (item.isDirectory()) {
          const subdirAssets = this.scanDirectory(fullPath, extensions);
          assets.push(...subdirAssets.map(asset => path.join(item.name, asset)));
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (extensions.length === 0 || extensions.includes(ext)) {
            assets.push(item.name);
          }
        }
      }
    } catch (error) {
      // Ignore directories that don't exist or can't be read
    }

    return assets;
  }

  private getAssetDetail(helper: string, assetPath: string): string {
    if (helper.includes('image')) {
      return `Image asset: ${assetPath}`;
    }

    if (helper.includes('javascript') || helper.includes('vite_javascript')) {
      return `JavaScript asset: ${assetPath}`;
    }

    if (helper.includes('stylesheet') || helper.includes('vite_stylesheet')) {
      return `Stylesheet asset: ${assetPath}`;
    }

    if (helper.includes('audio')) {
      return `Audio asset: ${assetPath}`;
    }

    if (helper.includes('video')) {
      return `Video asset: ${assetPath}`;
    }

    if (helper.includes('vite')) {
      return `Vite asset: ${assetPath}`;
    }

    return `Asset: ${assetPath}`;
  }
}
