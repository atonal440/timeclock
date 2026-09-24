// PR preview builds are served from `<site>/pr-preview/pr-<N>/` on the same
// origin as the live app, so they share its localStorage. To let a preview
// start from the real data without ever touching it, storage in a preview is
// copy-on-write:
//
//   - Until the preview changes anything, reads go straight to the live keys.
//   - On the first real change, every live `tc-*` key is snapshotted under
//     `preview:pr-<N>:` and from then on the preview reads/writes only that
//     copy. Live keys are never written from a preview.
//   - When the PR closes, its preview directory is removed from Pages. Any app
//     build (live or preview) that finds prefixed keys for a PR whose preview
//     now 404s deletes them.
//
// Keep the path regex and key format in sync with the inline theme script in
// index.html.

const PREVIEW_PATH = /\/pr-preview\/pr-(\d+)\//;
const KEY_PREFIX = /^preview:pr-(\d+):/;
const FORKED = '__forked';

export interface PreviewInfo {
  pr: number;
  prefix: string;
  /** Site root the preview lives under, e.g. `https://…/timeclock/`. */
  siteRoot: string;
}

export function detectPreview(pathname = location.pathname): PreviewInfo | null {
  const m = pathname.match(PREVIEW_PATH);
  if (!m) return null;
  const pr = Number(m[1]);
  return {
    pr,
    prefix: `preview:pr-${pr}:`,
    siteRoot: new URL(pathname.slice(0, m.index! + 1), location.origin).href,
  };
}

export const preview = detectPreview();

export function isForked(p: PreviewInfo = preview!): boolean {
  return localStorage.getItem(p.prefix + FORKED) !== null;
}

/** Snapshot all live `tc-*` keys into the preview's namespace. */
export function fork(p: PreviewInfo = preview!): void {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key.startsWith('tc-')) localStorage.setItem(p.prefix + key, localStorage.getItem(key)!);
  }
  localStorage.setItem(p.prefix + FORKED, new Date().toISOString());
}

/** Drop the preview's copy so it reads live data again. */
export function resetPreview(p: PreviewInfo = preview!): void {
  removeWithPrefix(p.prefix);
}

function removeWithPrefix(prefix: string): void {
  const doomed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key.startsWith(prefix)) doomed.push(key);
  }
  doomed.forEach(k => localStorage.removeItem(k));
}

/**
 * Delete stored copies belonging to PR previews that no longer exist. Only a
 * definite 404 counts; network errors (offline) leave the data alone.
 */
export async function cleanupClosedPreviews(): Promise<number[]> {
  const siteRoot = preview?.siteRoot ?? new URL('./', location.href).href;
  const prs = new Set<number>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = localStorage.key(i)!.match(KEY_PREFIX);
      if (m) prs.add(Number(m[1]));
    }
  } catch {
    return [];
  }

  const removed: number[] = [];
  for (const pr of prs) {
    if (pr === preview?.pr) continue;
    try {
      const res = await fetch(`${siteRoot}pr-preview/pr-${pr}/`, { method: 'HEAD', cache: 'no-store' });
      if (res.status === 404) {
        removeWithPrefix(`preview:pr-${pr}:`);
        removed.push(pr);
      }
    } catch {
      // Offline or blocked: try again next launch.
    }
  }
  return removed;
}
