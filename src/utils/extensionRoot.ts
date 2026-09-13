import path from 'node:path';

/**
 * Absolute path to the install directory, set once at activation. `__dirname` cannot do
 * it: the bundle and the `tsc` test build put this file at different depths.
 */
let extensionRoot: string | undefined;

/** Records the extension's install directory. Call first thing in `activate()`. */
export function setExtensionRoot(root: string): void {
  extensionRoot = root;
}

/**
 * In production {@link setExtensionRoot} always runs first. The `__dirname` fallback
 * serves code that runs without activation (the test suite, at `out/utils/`).
 */
export function getExtensionRoot(): string {
  return extensionRoot ?? path.join(__dirname, '..', '..');
}
