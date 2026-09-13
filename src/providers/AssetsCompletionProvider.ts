import * as vscode from 'vscode';
import * as path from 'path';

import { AssetFile, listAssetFiles } from '../rails/assetIndex';

// Matches a bare `{ '` / `{ "` opening (helper-independent), so it is compiled
// once instead of per helper on every completion trigger.
const BRACE_STRING_PATTERN = /\{\s*['"](.*?)$/;

// Where each kind of asset lives, relative to the workspace root (POSIX form;
// joined with the native separator when used). A helper may match several
// kinds: the pack/vite helpers serve both JavaScript and stylesheets.
const ASSET_DIRECTORIES: { matches: (helper: string) => boolean; dirs: string[] }[] = [
  {
    matches: (helper) => helper.includes('image') || helper === 'asset_path',
    dirs: ['app/assets/images', 'app/javascript/images', 'public/images', 'public/assets', 'vendor/assets/images'],
  },
  {
    matches: (helper) => /javascript|pack|vite/.test(helper) || helper === 'asset_path',
    dirs: [
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
    ],
  },
  {
    matches: (helper) => /stylesheet|pack|vite/.test(helper) || helper === 'asset_path',
    dirs: [
      'app/assets/builds',
      'app/assets/stylesheets',
      'app/javascript/stylesheets',
      'app/javascript/styles',
      'app/frontend',
      'app/frontend/stylesheets',
      'public/stylesheets',
      'public/assets',
      'vendor/assets/stylesheets',
    ],
  },
  {
    matches: (helper) => helper.includes('audio') || helper === 'asset_path',
    dirs: ['app/assets/audios', 'public/audios', 'public/assets'],
  },
  {
    matches: (helper) => helper.includes('video') || helper === 'asset_path',
    dirs: ['app/assets/videos', 'public/videos', 'public/assets'],
  },
];

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
    const directories = ASSET_DIRECTORIES.filter(({ matches }) => matches(helper)).flatMap(({ dirs }) => dirs);

    return Array.from(new Set(directories), (dir) => path.join(workspacePath, ...dir.split('/')));
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
