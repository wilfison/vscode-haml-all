import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * A single file discovered under an asset directory. All the fields consumers
 * need are precomputed once at scan time so that hot paths (a CodeLens that
 * re-runs on every edit, a completion that re-triggers as you type) only do
 * cheap in-memory string comparisons instead of touching disk.
 */
export interface AssetFile {
  /** Absolute path on disk. */
  fullPath: string;
  /** Path relative to the scanned asset root (native separator). */
  relativePath: string;
  /** File name including extension. */
  name: string;
  /** File name without its extension. */
  nameWithoutExt: string;
  /** Lower-cased extension including the leading dot (e.g. ".png"). */
  ext: string;
}

interface CacheEntry {
  files: AssetFile[];
  loadedAt: number;
}

// Asset directories are walked recursively, which is expensive on large trees
// (a built `public/assets` can hold thousands of fingerprinted files). The
// listing only stores paths, so it is invalidated when files are added/removed
// (see the watcher in EventSubscriber) — a plain content edit never changes it.
// The TTL is a backstop in case a create/delete event is ever missed.
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Returns every file under {@link directory} (recursively), served from an
 * in-memory cache. A missing or unreadable directory yields an empty list, so
 * callers need not pre-check existence. Safe to call on every keystroke.
 */
export function listAssetFiles(directory: string): AssetFile[] {
  const cached = cache.get(directory);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    return cached.files;
  }

  const files: AssetFile[] = [];
  walk(directory, directory, files);
  cache.set(directory, { files, loadedAt: Date.now() });

  return files;
}

/**
 * Drops all cached listings. Called when an asset file is created or deleted so
 * the next lookup rebuilds from disk.
 */
export function invalidateAssetIndex(): void {
  cache.clear();
}

function walk(root: string, current: string, out: AssetFile[]): void {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch (error) {
    // Directory does not exist or cannot be read — treat as empty.
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      walk(root, fullPath, out);
    } else if (entry.isFile()) {
      const rawExt = path.extname(entry.name);

      out.push({
        fullPath,
        relativePath: path.relative(root, fullPath),
        name: entry.name,
        nameWithoutExt: path.basename(entry.name, rawExt),
        ext: rawExt.toLowerCase(),
      });
    }
  }
}
