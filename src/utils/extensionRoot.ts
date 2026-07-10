import path from 'node:path';

/**
 * Absolute path to the extension's install directory (the folder holding
 * `lib/`, `templates/`, `dist/`, …). Set once at activation from
 * `context.extensionPath`.
 *
 * Bundling collapses every module into `dist/extension.js`, so `__dirname` can
 * no longer be used to walk up to the extension root a fixed number of levels
 * (the depth differs between the bundled build and the `tsc` test build). The
 * extension context knows the real install path regardless of layout, so we
 * capture it here and resolve bundled asset paths against it.
 */
let extensionRoot: string | undefined;

/** Records the extension's install directory. Call first thing in `activate()`. */
export function setExtensionRoot(root: string): void {
  extensionRoot = root;
}

/**
 * Returns the extension's install directory.
 *
 * In production {@link setExtensionRoot} is always called before any consumer
 * runs. The `__dirname` fallback only serves code paths that run without
 * activation (the test suite, where this file lives at `out/utils/` — two
 * levels below the repo root).
 */
export function getExtensionRoot(): string {
  return extensionRoot ?? path.join(__dirname, '..', '..');
}
