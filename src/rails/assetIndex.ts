import * as fs from 'node:fs';
import * as path from 'node:path';

import { toPosix } from '../utils/file';

/**
 * A file under an asset directory, with every field consumers need precomputed at scan
 * time, so a CodeLens or completion compares strings instead of touching disk.
 */
export interface AssetFile {
  /** Absolute path on disk. */
  fullPath: string;
  /** Path relative to the scanned asset root, always with `/` separators. */
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

// The recursive walk is expensive on a built `public/assets`. The listing only stores
// paths, so create/delete invalidates it; the TTL is a backstop for a missed event.
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Every file under {@link directory}, recursively, from an in-memory cache. A missing or
 * unreadable directory yields an empty list, so this is safe on every keystroke.
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

// Build output under public/ churns constantly and a fingerprinted bundle is never what
// a completion offers, so those trees must not invalidate the index on every write.
const PUBLIC_BUILD_DIRS = ['assets', 'packs', 'packs-test', 'builds', 'vite'];

/**
 * Whether a created or deleted file should drop the cached asset listing.
 * Takes a workspace-relative path with `/` separators.
 */
export function assetPathInvalidatesIndex(relativePath: string): boolean {
  const [first, second] = relativePath.split('/');

  if (first !== 'public') {
    return true;
  }

  return !PUBLIC_BUILD_DIRS.includes(second);
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
    // Directory does not exist or cannot be read: treat as empty.
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
        relativePath: toPosix(path.relative(root, fullPath)),
        name: entry.name,
        nameWithoutExt: path.basename(entry.name, rawExt),
        ext: rawExt.toLowerCase(),
      });
    }
  }
}
