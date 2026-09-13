import { RelativePattern, Uri, workspace } from 'vscode';

import { toPosix } from '../utils/file';

/**
 * A partial under some `app/views`, pre-split into the parts lookups compare, so
 * resolution is string work on an in-memory list instead of a walk over the disk.
 */
export interface PartialFile {
  /** Absolute path, with the platform's own separators. */
  fullPath: string;
  /** The `app/views` directory holding it, POSIX form (an engine has its own). */
  viewsRoot: string;
  /** Path under `viewsRoot` without extensions or variant, e.g. `users/_row`. */
  logicalPath: string;
  /** Directory under `viewsRoot`, e.g. `users`; empty at the root. */
  dir: string;
  /** File name without extensions or variant, e.g. `_row`. */
  baseName: string;
  /** Everything after the base name, e.g. `html.haml` or `+mobile.html.haml`. */
  variant: string;
}

const VIEWS_SEGMENT = '/app/views/';

// How a template is preferred when a partial exists in several forms. Anything
// unlisted (a variant, `.turbo_stream.haml`) sorts after these, alphabetically.
const VARIANT_ORDER = ['html.haml', 'haml', 'html.erb', 'erb'];

const INCLUDE_GLOB = '**/app/views/**/_*.{haml,erb}';
const EXCLUDE_GLOB = '**/{node_modules,vendor,tmp,log,public}/**';

let cache: PartialFile[] | null = null;
let building: Promise<PartialFile[]> | null = null;

/**
 * Describes a partial from its absolute path. Returns null for a path that is
 * not under an `app/views` directory.
 */
export function partialFileFrom(absolutePath: string): PartialFile | null {
  const posixPath = toPosix(absolutePath);
  const viewsIndex = posixPath.lastIndexOf(VIEWS_SEGMENT);

  if (viewsIndex === -1) {
    return null;
  }

  const viewsRoot = posixPath.slice(0, viewsIndex + VIEWS_SEGMENT.length - 1);
  const relativePath = posixPath.slice(viewsIndex + VIEWS_SEGMENT.length);
  const segments = relativePath.split('/');
  const fileName = segments.pop() as string;

  // `_row+mobile.html.haml` -> base `_row`, variant `+mobile.html.haml`.
  const variantStart = fileName.search(/[.+]/);
  const baseName = variantStart === -1 ? fileName : fileName.slice(0, variantStart);
  const variant = variantStart === -1 ? '' : fileName.slice(variantStart).replace(/^\./, '');
  const dir = segments.join('/');

  return {
    fullPath: absolutePath,
    viewsRoot,
    logicalPath: dir ? `${dir}/${baseName}` : baseName,
    dir,
    baseName,
    variant,
  };
}

/**
 * Every partial in the workspace, kept until one appears or disappears under `app/views`.
 * Concurrent callers share one scan: they all fire together on the same keystroke.
 */
export async function getPartialIndex(): Promise<PartialFile[]> {
  if (cache) {
    return cache;
  }

  if (!building) {
    building = buildIndex().then((files) => {
      cache = files;
      building = null;
      return files;
    });
  }

  return building;
}

/** Drops the index; the next lookup rebuilds it. */
export function invalidatePartialIndex(): void {
  cache = null;
  building = null;
}

/**
 * Test seam: uses `files` as the index instead of scanning the workspace. The
 * test host opens no folder, so `workspace.findFiles` would find nothing.
 */
export function setPartialIndex(files: PartialFile[] | null): void {
  invalidatePartialIndex();
  cache = files;
}

/** Whether a path that changed should drop the index. */
export function partialPathInvalidatesIndex(relativePath: string): boolean {
  return relativePath.includes('app/views/');
}

/** Watches every workspace folder for partials appearing or disappearing. */
export function watchPartials(invalidate: () => void = invalidatePartialIndex) {
  return (workspace.workspaceFolders ?? []).map((folder) => {
    // Content changes are ignored: the index holds paths only.
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(folder, '**/app/views/**'), false, true, false);

    watcher.onDidCreate(invalidate);
    watcher.onDidDelete(invalidate);

    return watcher;
  });
}

/**
 * The files a `render` refers to, best match first. A name with a directory is a path
 * under some `app/views`, a bare name is looked up beside the current file first.
 *
 * @param partialName - already carrying the leading underscore (`formatPartialName`)
 * @param currentViewFile - the file the `render` was typed in
 */
export function resolvePartial(index: PartialFile[], partialName: string, currentViewFile: string): string[] {
  if (!partialName) {
    return [];
  }

  const current = partialFileFrom(currentViewFile);
  const matches = matchPartial(index, partialName, current);

  if (matches.length > 0) {
    return matches;
  }

  // `render @users` / `collection: @rows` name the collection, not the partial.
  const singular = singularize(partialName);

  return singular === partialName ? [] : matchPartial(index, singular, current);
}

function matchPartial(index: PartialFile[], partialName: string, current: PartialFile | null): string[] {
  const candidates = partialName.includes('/')
    ? index.filter((file) => file.logicalPath === partialName)
    : index.filter((file) => file.baseName === partialName);

  if (candidates.length === 0) {
    return [];
  }

  const best = candidates.sort(
    (a, b) => proximity(b, current) - proximity(a, current) || a.logicalPath.localeCompare(b.logicalPath)
  )[0];

  return candidates
    .filter((file) => file.viewsRoot === best.viewsRoot && file.logicalPath === best.logicalPath)
    .sort((a, b) => variantRank(a.variant) - variantRank(b.variant) || a.variant.localeCompare(b.variant))
    .map((file) => file.fullPath);
}

// How close a partial is to the file rendering it: same app first, then the
// number of leading directory segments the two share.
function proximity(file: PartialFile, current: PartialFile | null): number {
  if (!current) {
    return 0;
  }

  const sameRoot = file.viewsRoot === current.viewsRoot ? 1000 : 0;
  const fileSegments = file.dir.split('/');
  const currentSegments = current.dir.split('/');

  let shared = 0;
  while (shared < fileSegments.length && fileSegments[shared] === currentSegments[shared]) {
    shared += 1;
  }

  return sameRoot + shared;
}

function variantRank(variant: string): number {
  const index = VARIANT_ORDER.indexOf(variant);

  return index === -1 ? VARIANT_ORDER.length : index;
}

// ponytail: naive inflector, swap for a table if a real project breaks it. It only undoes
// the plural in `render @users`, and a miss costs one failed lookup.
function singularize(name: string): string {
  if (/(?:s|x|z|ch|sh)es$/.test(name)) {
    return name.slice(0, -2);
  }

  if (/[^aeiou]ies$/.test(name)) {
    return `${name.slice(0, -3)}y`;
  }

  return name.endsWith('s') && !name.endsWith('ss') ? name.slice(0, -1) : name;
}

async function buildIndex(): Promise<PartialFile[]> {
  const uris = await workspace.findFiles(INCLUDE_GLOB, EXCLUDE_GLOB);

  return uris.map((uri: Uri) => partialFileFrom(uri.fsPath)).filter((file): file is PartialFile => file !== null);
}
