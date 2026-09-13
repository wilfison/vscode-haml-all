import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { OutputChannel, workspace } from 'vscode';

import { SOURCE } from './linter';
import { isPathCommand, splitCommand } from './utils/command';
import { getWorkspaceRoot } from './utils/file';

// execFile (argv, no shell): the path comes from settings, so a shell would make
// `.vscode/settings.json` a command injection. Async, since a Ruby boot takes seconds.
function commandAvailable(executable: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(executable, ['--version'], { timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
}

export function hamlLintPresent(): Promise<boolean> {
  const config = workspace.getConfiguration('hamlAll');

  // With `useBundler` the gem lives in the bundle, where a global probe proves nothing
  // and only yields a bogus error. A real failure surfaces on server start-up instead.
  if (config.useBundler) {
    return Promise.resolve(true);
  }

  const executable = config.linterExecutablePath || SOURCE;

  return commandAvailable(executable);
}

export const DEFAULT_RAILS_COMMAND = 'bin/rails';

/**
 * Picks the rails command out of the new setting, the deprecated one, then the
 * default. Pure so it can be tested without a configuration.
 */
export function resolveRailsCommand(hamlAllValue?: string, deprecatedValue?: string): string {
  return hamlAllValue?.trim() || deprecatedValue?.trim() || DEFAULT_RAILS_COMMAND;
}

// Value explicitly set by the user, ignoring the package.json default: that is what
// tells us whether to fall back to the deprecated setting.
function explicitValue(section: string, key: string): string | undefined {
  const inspected = workspace.getConfiguration(section).inspect<string>(key);

  return inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
}

/**
 * The rails command to run, honouring `hamlAll.railsCommand` and falling back to
 * the deprecated `railsRoutes.railsCommand`.
 */
export function railsCommand(): string {
  return resolveRailsCommand(explicitValue('hamlAll', 'railsCommand'), explicitValue('railsRoutes', 'railsCommand'));
}

/** Ruby interpreter used to run the lint server (`hamlAll.rubyCommand`). */
export function rubyCommand(): string {
  return workspace.getConfiguration('hamlAll').get<string>('rubyCommand')?.trim() || 'ruby';
}

// Checks the rails command on disk instead of spawning it: booting `bin/rails` during
// activation can take seconds. A relative command resolves against the workspace root.
export function isARailsProject(outputChanel: OutputChannel | null): boolean {
  const [executable] = splitCommand(railsCommand());

  // A bare name ("bundle") cannot be checked on disk, so probe the default bin/rails,
  // which every generated Rails app ships.
  const probe = isPathCommand(executable) ? executable : DEFAULT_RAILS_COMMAND;
  const railsPath = path.isAbsolute(probe) ? probe : path.join(getWorkspaceRoot(), probe);

  if (existsSync(railsPath)) {
    outputChanel?.appendLine('Rails project detected.');
    return true;
  }

  return false;
}
