import fs from 'node:fs';

import { CancellationToken, CodeLens, TextDocument, CodeLensProvider as VSCodeLensProvider } from 'vscode';

import * as fileHelper from '../utils/file';

// Caches each controller's split lines keyed by mtime, so the CodeLens — which
// re-runs on every edit of the view — reads and splits the controller file only
// when it actually changes instead of on each refresh.
const controllerLinesCache = new Map<string, { mtimeMs: number; lines: string[] }>();

function readControllerLines(controllerPath: string): string[] {
  let mtimeMs: number;

  try {
    mtimeMs = fs.statSync(controllerPath).mtimeMs;
  } catch (error) {
    return [];
  }

  const cached = controllerLinesCache.get(controllerPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.lines;
  }

  const lines = fs.readFileSync(controllerPath, 'utf-8').split('\n');
  controllerLinesCache.set(controllerPath, { mtimeMs, lines });

  return lines;
}

class CodeLensProvider implements VSCodeLensProvider {
  public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] {
    const [controllerPath, lineNumber] = this.getControllerFilePath(document);

    if (!controllerPath) {
      return [];
    }

    const title = fileHelper.isPartialDocument(document) ? 'Jump to Controller' : 'Jump to controller Action';

    const codeLens: CodeLens = new CodeLens(document.lineAt(0).range, {
      command: 'hamlAll.openFile',
      title: title,
      arguments: [controllerPath, lineNumber],
    });

    return [codeLens];
  }

  private getControllerFilePath(document: TextDocument): (string | number)[] {
    const viewsPath = document.uri.path.split('/app/views/')[1];

    // Check if the document is in the views directory
    if (!viewsPath) {
      return ['', 0];
    }

    const workspaceRoot = document.uri.path.split('/app/')[0];
    const viewPath = viewsPath.split('/').slice(0, -1).join('/');
    const controllerPath = `${workspaceRoot}/app/controllers/${viewPath}_controller.rb`;

    if (!fs.existsSync(controllerPath)) {
      return ['', 0];
    }

    const actionRange = this.controllerActionLine(document, controllerPath);

    return [controllerPath, actionRange];
  }

  private controllerActionLine(document: TextDocument, controllerPath: string): number {
    const action = document.fileName.split('/').pop()?.split('.')[0];
    if (!action) {
      return 0;
    }

    const actionLine = readControllerLines(controllerPath).findIndex((line) => {
      return line.includes(` def ${action}`);
    });

    if (actionLine === -1) {
      return 0;
    }

    return actionLine;
  }
}

export default CodeLensProvider;
