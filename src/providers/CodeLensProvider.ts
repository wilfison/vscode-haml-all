import fs from 'node:fs';
import path from 'node:path';

import { CancellationToken, CodeLens, TextDocument, workspace, CodeLensProvider as VSCodeLensProvider } from 'vscode';

import * as fileHelper from '../utils/file';

const VIEWS_PREFIX = 'app/views/';

/**
 * Maps a view file to its controller, both absolute, or '' outside app/views. Anchored
 * on the workspace root: searching the path for "/app/" matches `/home/x/app/project`.
 */
export function resolveControllerPath(workspaceRoot: string, documentPath: string): string {
  const relativePath = fileHelper.toPosix(path.relative(workspaceRoot, documentPath));

  if (!relativePath.startsWith(VIEWS_PREFIX)) {
    return '';
  }

  const viewPath = relativePath.slice(VIEWS_PREFIX.length).split('/').slice(0, -1).join('/');

  if (!viewPath) {
    return '';
  }

  return path.join(workspaceRoot, 'app', 'controllers', `${viewPath}_controller.rb`);
}

// Keyed by mtime, so the CodeLens (which re-runs on every edit of the view) reads and
// splits the controller file only when it actually changes.
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
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

    // A loose file with no folder open has no controller to jump to.
    if (!workspaceFolder) {
      return ['', 0];
    }

    const controllerPath = resolveControllerPath(workspaceFolder.uri.fsPath, document.uri.fsPath);

    if (!controllerPath || !fs.existsSync(controllerPath)) {
      return ['', 0];
    }

    const actionRange = this.controllerActionLine(document, controllerPath);

    return [controllerPath, actionRange];
  }

  private controllerActionLine(document: TextDocument, controllerPath: string): number {
    const action = fileHelper.toPosix(document.fileName).split('/').pop()?.split('.')[0];
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
