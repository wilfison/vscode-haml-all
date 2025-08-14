import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { IMAGE_EXTENSIONS, IMAGE_HELPERS } from '../data/rails_helpers';

export default class ImagePreviewCodeLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
      const line = document.lineAt(lineIndex);
      const imageReferences = this.findImageReferences(line.text, lineIndex);

      for (const imageRef of imageReferences) {
        const imagePath = this.findImagePath(imageRef.imageName);

        if (imagePath) {
          const codeLens = new vscode.CodeLens(
            imageRef.range,
            {
              title: '$(eye) Preview Image',
              command: 'hamlAll.previewImage',
              arguments: [imagePath, imageRef.imageName]
            }
          );
          codeLenses.push(codeLens);
        }
      }
    }

    return codeLenses;
  }

  private findImageReferences(lineText: string, lineIndex: number): Array<{ imageName: string, range: vscode.Range }> {
    const references: Array<{ imageName: string, range: vscode.Range }> = [];

    if (!this.isImageHelper(lineText)) {
      return references;
    }

    // First check for images with explicit extensions
    const regexWithExt = /['"]([\w\-\.\/\\:]+\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|avif))['"]/gi;
    let match;

    while ((match = regexWithExt.exec(lineText)) !== null) {
      const imageName = match[1];
      const startPos = match.index + 1; // Skip opening quote
      const endPos = startPos + imageName.length;

      const range = new vscode.Range(
        new vscode.Position(lineIndex, startPos),
        new vscode.Position(lineIndex, endPos)
      );

      references.push({ imageName, range });
    }

    // Then check for images without extensions (Rails convention)
    if (references.length === 0) {
      const regexWithoutExt = /['"]([\w\-\.\/\\:]+)['"]/gi;
      regexWithoutExt.lastIndex = 0;

      while ((match = regexWithoutExt.exec(lineText)) !== null) {
        const imageName = match[1];

        // Skip if it looks like a path or contains common non-image keywords
        if (imageName.includes('path') || imageName.includes('url') ||
          imageName.includes('controller') || imageName.includes('action')) {
          continue;
        }

        // Check if this imageName could be an image by trying to find it
        const imagePath = this.findImagePath(imageName);
        if (imagePath) {
          const startPos = match.index + 1; // Skip opening quote
          const endPos = startPos + imageName.length;

          const range = new vscode.Range(
            new vscode.Position(lineIndex, startPos),
            new vscode.Position(lineIndex, endPos)
          );

          references.push({ imageName, range });
        }
      }
    }

    return references;
  }

  private isImageHelper(line: string): boolean {
    return IMAGE_HELPERS.some(helper => {
      return line.includes(helper);
    });
  }

  private findImagePath(imageName: string): string | null {
    if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
      // Skip remote URLs
      return imageName;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }

    const imageDirectories = this.getImageDirectories(workspaceFolder.uri.fsPath);

    for (const dir of imageDirectories) {
      if (fs.existsSync(dir)) {
        const imagePath = this.searchImageInDirectory(dir, imageName);
        if (imagePath) {
          return imagePath;
        }
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
      path.join(workspacePath, 'vendor', 'assets', 'images')
    ];
  }

  private searchImageInDirectory(directory: string, imageName: string): string | null {
    try {
      const items = fs.readdirSync(directory, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(directory, item.name);

        if (item.isDirectory()) {
          const found = this.searchImageInDirectory(fullPath, imageName);
          if (found) {
            return found;
          }
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          const nameWithoutExt = path.basename(item.name, ext);

          if (IMAGE_EXTENSIONS.includes(ext)) {
            // Exact match with extension
            if (item.name === imageName) {
              return fullPath;
            }

            // Match without extension (Rails convention)
            if (nameWithoutExt === imageName ||
              nameWithoutExt === path.basename(imageName, path.extname(imageName))) {
              return fullPath;
            }

            // Match with path
            const relativePath = path.relative(directory, fullPath);
            const normalizedRelativePath = relativePath.replace(/\\/g, '/');
            const normalizedImageName = imageName.replace(/\\/g, '/');

            if (normalizedRelativePath === normalizedImageName ||
              normalizedRelativePath === normalizedImageName + ext ||
              path.basename(normalizedRelativePath, ext) ===
              path.basename(normalizedImageName, path.extname(normalizedImageName))) {
              return fullPath;
            }

            // Try subdirectory matching for nested images
            const pathParts = normalizedImageName.split('/');
            if (pathParts.length > 1) {
              const fileName = pathParts[pathParts.length - 1];
              if (nameWithoutExt === fileName || item.name === fileName) {
                return fullPath;
              }
            }
          }
        }
      }
    } catch (error) {
      // Ignore directories that don't exist or can't be read
    }

    return null;
  }

  public static async showImagePreview(imagePath: string, imageName: string): Promise<void> {
    const isRemoteImage = imagePath.startsWith('http');
    const imageFileUri = isRemoteImage ? vscode.Uri.parse(imagePath) : vscode.Uri.file(imagePath);

    const panel = vscode.window.createWebviewPanel(
      'imagePreview',
      `🖼️ ${imageName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: isRemoteImage ? undefined : [vscode.Uri.file(path.dirname(imagePath))]
      }
    );

    const imageUri = panel.webview.asWebviewUri(imageFileUri);
    const imageStats = isRemoteImage ? { size: 0 } : fs.statSync(imagePath);
    const imageSizeKB = Math.round(imageStats.size / 1024);
    const imageExt = path.extname(imagePath).toLowerCase();
    const workspaceFolder = isRemoteImage ? undefined : vscode.workspace.workspaceFolders?.[0];
    const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, imagePath) : imagePath;

    panel.webview.html = ImagePreviewCodeLensProvider.getWebviewContent(imageUri, imageName, relativePath, imageSizeKB, imageExt);

    panel.onDidDispose(() => {
      // Clean up resources when panel is closed
    });
  }

  private static getWebviewContent(
    imageUri: vscode.Uri,
    imageName: string,
    imagePath: string,
    imageSize: number,
    imageExt: string
  ): string {
    const template = fs.readFileSync(
      path.join(__dirname, '..', '..', 'templates', 'webview_image_preview.html'),
      'utf8'
    );

    return template
      .replace(/{{imageUri}}/g, imageUri.toString())
      .replace(/{{imageName}}/g, imageName)
      .replace(/{{imagePath}}/g, imagePath)
      .replace(/{{imageSize}}/g, `${imageSize} KB`)
      .replace(/{{imageExt}}/g, imageExt.toUpperCase().substring(1));
  }
}
