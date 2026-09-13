import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { IMAGE_EXTENSIONS, IMAGE_HELPERS } from '../data/rails_helpers';
import { AssetFile, listAssetFiles } from '../rails/assetIndex';
import { getExtensionRoot } from '../utils/extensionRoot';

// The first quoted argument of each image helper call on a line. Anchoring on
// the helper is what keeps `alt:`, `class:` and every other quoted option out:
// scanning the whole line meant probing the disk for every string on it.
// Compiled once; it carries the global flag, so `lastIndex` is reset before
// each scan (see findImageReferences).
const IMAGE_HELPER_ARGUMENT_REGEX = new RegExp(`\\b(?:${IMAGE_HELPERS.join('|')})\\s*\\(?\\s*['"]([^'"]+)['"]`, 'g');

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Fills `{{placeholder}}` slots in the webview template, escaping every value.
 * The values come from the repository (file names, paths), so they are
 * untrusted input: interpolating them raw would make a crafted file name run
 * as markup inside the webview.
 *
 * The replacement is a function so that `$&` and friends in an escaped value
 * are never treated as replacement patterns.
 */
export function renderWebviewTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((html, [key, value]) => {
    const escaped = escapeHtml(value);

    return html.replace(new RegExp(`{{${key}}}`, 'g'), () => escaped);
  }, template);
}

export default class ImagePreviewCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      if (token.isCancellationRequested) {
        return codeLenses;
      }

      const line = document.lineAt(lineIndex);
      const imageReferences = this.findImageReferences(line.text, lineIndex);

      for (const imageRef of imageReferences) {
        const imagePath = this.findImagePath(imageRef.imageName);

        if (imagePath) {
          const codeLens = new vscode.CodeLens(imageRef.range, {
            title: '$(eye) Preview Image',
            command: 'hamlAll.previewImage',
            arguments: [imagePath, imageRef.imageName],
          });
          codeLenses.push(codeLens);
        }
      }
    }

    return codeLenses;
  }

  private findImageReferences(lineText: string, lineIndex: number): Array<{ imageName: string; range: vscode.Range }> {
    const references: Array<{ imageName: string; range: vscode.Range }> = [];

    IMAGE_HELPER_ARGUMENT_REGEX.lastIndex = 0;
    let match;

    while ((match = IMAGE_HELPER_ARGUMENT_REGEX.exec(lineText)) !== null) {
      const imageName = match[1];
      // Whether the name carries an extension does not matter here: resolution
      // happens in provideCodeLenses, and it accepts both forms.
      const startPos = match.index + match[0].length - imageName.length - 1;
      const endPos = startPos + imageName.length;

      const range = new vscode.Range(new vscode.Position(lineIndex, startPos), new vscode.Position(lineIndex, endPos));

      references.push({ imageName, range });
    }

    return references;
  }

  private findImagePath(imageName: string): string | null {
    if (imageName.startsWith('https://')) {
      // Remote URLs are handed to the webview as-is.
      return imageName;
    }

    // Plain http is refused: the webview CSP allows https: only, and loading it
    // would leak the user's IP to the image host over an unauthenticated link.
    if (imageName.startsWith('http://')) {
      return null;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }

    const imageDirectories = this.getImageDirectories(workspaceFolder.uri.fsPath);

    for (const dir of imageDirectories) {
      const imagePath = this.searchImageInDirectory(dir, imageName);
      if (imagePath) {
        return imagePath;
      }
    }

    return null;
  }

  private getImageDirectories(workspacePath: string): string[] {
    return [
      path.join(workspacePath, 'app', 'assets', 'images'),
      path.join(workspacePath, 'app', 'javascript', 'images'),
      path.join(workspacePath, 'public', 'images'),
      path.join(workspacePath, 'public', 'assets'),
      path.join(workspacePath, 'vendor', 'assets', 'images'),
    ];
  }

  private searchImageInDirectory(directory: string, imageName: string): string | null {
    for (const file of listAssetFiles(directory)) {
      if (this.matchesImage(file, imageName)) {
        return file.fullPath;
      }
    }

    return null;
  }

  private matchesImage(file: AssetFile, imageName: string): boolean {
    const { name, nameWithoutExt, ext } = file;

    if (!IMAGE_EXTENSIONS.includes(ext)) {
      return false;
    }

    // Exact match with extension
    if (name === imageName) {
      return true;
    }

    // Match without extension (Rails convention)
    if (nameWithoutExt === imageName || nameWithoutExt === path.basename(imageName, path.extname(imageName))) {
      return true;
    }

    // Match against the file name. (The original recursive scan compared the
    // path relative to the *immediate* parent directory, which always reduced
    // to the base name — preserved here.)
    const normalizedName = name.replace(/\\/g, '/');
    const normalizedImageName = imageName.replace(/\\/g, '/');

    if (
      normalizedName === normalizedImageName ||
      normalizedName === normalizedImageName + ext ||
      path.basename(normalizedName, ext) === path.basename(normalizedImageName, path.extname(normalizedImageName))
    ) {
      return true;
    }

    // Try subdirectory matching for nested images
    const pathParts = normalizedImageName.split('/');
    if (pathParts.length > 1) {
      const fileName = pathParts[pathParts.length - 1];
      if (nameWithoutExt === fileName || name === fileName) {
        return true;
      }
    }

    return false;
  }

  public static async showImagePreview(imagePath: string, imageName: string): Promise<void> {
    const isRemoteImage = imagePath.startsWith('http');
    const imageFileUri = isRemoteImage ? vscode.Uri.parse(imagePath) : vscode.Uri.file(imagePath);

    // The file can disappear between the code lens being drawn and the click.
    const imageStats = isRemoteImage ? { size: 0 } : fs.statSync(imagePath, { throwIfNoEntry: false });

    if (!imageStats) {
      vscode.window.showErrorMessage(`Image not found: ${imagePath}`);
      return;
    }

    const imageSizeKB = imageStats.size > 0 ? `${Math.round(imageStats.size / 1024)} KB` : 'Unknown';
    const imageExt = path.extname(imagePath).toLowerCase();
    const workspaceFolder = isRemoteImage ? undefined : vscode.workspace.workspaceFolders?.[0];
    const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, imagePath) : imageFileUri.authority;
    const title = isRemoteImage ? `📷 (Remote) ${imageFileUri.authority}` : `📷 ${imageName}`;

    const panel = vscode.window.createWebviewPanel('imagePreview', title, vscode.ViewColumn.Beside, {
      // The panel only displays an image; scripts would buy nothing and would
      // widen the blast radius of any escaping mistake.
      enableScripts: false,
      localResourceRoots: isRemoteImage ? undefined : [vscode.Uri.file(path.dirname(imagePath))],
    });

    const imageUri = panel.webview.asWebviewUri(imageFileUri);

    panel.webview.html = ImagePreviewCodeLensProvider.getWebviewContent(
      imageUri,
      imageName,
      relativePath,
      imageSizeKB,
      imageExt,
      panel.webview.cspSource
    );

    panel.onDidDispose(() => {
      // Clean up resources when panel is closed
    });
  }

  public static getWebviewContent(
    imageUri: vscode.Uri,
    imageName: string,
    imagePath: string,
    imageSize: string,
    imageExt: string,
    cspSource: string
  ): string {
    const template = fs.readFileSync(path.join(getExtensionRoot(), 'templates', 'webview_image_preview.html'), 'utf8');

    return renderWebviewTemplate(template, {
      cspSource,
      imageUri: imageUri.toString(),
      imageName,
      imagePath,
      imageSize,
      imageExt: imageExt.toUpperCase().substring(1),
    });
  }
}
