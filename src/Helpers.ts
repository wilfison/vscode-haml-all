import { exec } from 'node:child_process';
import { OutputChannel, workspace } from 'vscode';

import { SOURCE } from './linter';

export function hamlLintPresent(): boolean {
  const config = workspace.getConfiguration('hamlAll');
  let executable = config.linterExecutablePath || SOURCE;

  try {
    exec(`${executable} --version`);
    return true;
  } catch (e) {
    return false;
  }
}

export function isARailsProject(outputChanel: OutputChannel | null): boolean {
  const config = workspace.getConfiguration('railsRoutes');
  let executable = config.railsCommand || 'bin/rails';

  try {
    exec(`${executable} --version`);
    outputChanel?.appendLine('Rails project detected.');

    return true;
  } catch (e) {
    return false;
  }
}
