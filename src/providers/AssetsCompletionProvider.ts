import * as vscode from 'vscode';
import * as path from 'path';

import { AssetFile, listAssetFiles } from '../rails/assetIndex';

// Matches a bare `{ '` / `{ "` opening (helper-independent), so it is compiled
// once instead of per helper on every completion trigger.
const BRACE_STRING_PATTERN = /\{\s*['"](.*?)$/;

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
    'vite_asset_path',
  ];

  // Per-helper matching patterns, compiled once. Rebuilding these on every
  // keystroke (5 patterns × 13 helpers) was pure, avoidable GC churn.
  private readonly helperPatterns: Map<string, RegExp[]>;

  constructor() {
    this.helperPatterns = new Map(
      this.assetHelpers.map((helper) => [
        helper,
        [
          new RegExp(`=\\s*${helper}\\s*\\(?\\s*['"](.*?)$`),
          new RegExp(`=\\s*${helper}\\s*\\(?\\s*([^'"][^,\\)\\s]*?)$`),
          new RegExp(`=\\s*${helper}\\s*\\(\\s*['"](.*?)$`),
          new RegExp(`\\b${helper}\\s*\\(?\\s*['"](.*?)$`),
          BRACE_STRING_PATTERN,
        ],
      ])
    );
  }

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
      if (!linePrefix.includes(helper)) {
        continue;
      }

      const patterns = this.helperPatterns.get(helper) ?? [];

      for (const pattern of patterns) {
        const match = linePrefix.match(pattern);
        if (match) {
          return {
            helper,
            prefix: match[1] || '',
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

    const assetFiles = this.getAssetFiles(helper, workspaceFolder.uri.fsPath);
    const completions: vscode.CompletionItem[] = [];

    for (const assetFile of assetFiles) {
      const assetName = this.getAssetName(helper, assetFile);

      if (assetName.startsWith(prefix)) {
        const completion = new vscode.CompletionItem(assetName, vscode.CompletionItemKind.File);
        completion.detail = this.getAssetDetail(helper, assetFile.relativePath);
        completion.insertText = assetName;
        completion.sortText = assetName;
        completion.documentation = new vscode.MarkdownString(`**File:** \`${assetFile.relativePath}\``);
        completions.push(completion);
      }
    }

    return completions;
  }

  private getAssetName(helper: string, assetFile: AssetFile): string {
    if (helper.includes('javascript') || helper.includes('stylesheet') || helper.includes('vite')) {
      return assetFile.nameWithoutExt;
    }
    return assetFile.relativePath;
  }

  private getAssetFiles(helper: string, workspacePath: string): AssetFile[] {
    const assetDirectories = this.getAssetDirectories(helper, workspacePath);
    const extensions = this.getAssetExtensions(helper);
    const assets: AssetFile[] = [];

    for (const dir of assetDirectories) {
      for (const file of listAssetFiles(dir)) {
        if (extensions.length === 0 || extensions.includes(file.ext)) {
          assets.push(file);
        }
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
