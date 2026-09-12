import path from 'node:path';

/**
 * Splits a configured command into argv form ("bundle exec rails" ->
 * ["bundle", "exec", "rails"]). Commands come from settings, so they are handed
 * to spawn as argv and never to a shell.
 */
export function splitCommand(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

/**
 * Whether a command token is a path — and therefore resolvable against the
 * workspace root — rather than a bare name looked up in PATH.
 */
export function isPathCommand(executable: string): boolean {
  return path.isAbsolute(executable) || /[\\/]/.test(executable);
}
