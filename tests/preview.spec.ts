import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// Serves the built app at /pr-preview/pr-<N>/ (as GitHub Pages does for PR
// previews) and checks that previews read live data, write only to their own
// prefixed copy, and that copies for closed PRs get cleaned up.

const DIST = path.resolve(import.meta.dirname, '../dist');

test.use({ serviceWorkers: 'block' });

async function servePreviews(page: Page, open: number[]) {
  await page.route(/\/pr-preview\/pr-(\d+)\/(.*)$/, (route, request) => {
    const [, pr, rest] = new URL(request.url()).pathname.match(/\/pr-preview\/pr-(\d+)\/(.*)$/)!;
    if (!open.includes(Number(pr))) return route.fulfill({ status: 404, body: 'Not found' });
    return route.fulfill({ path: path.join(DIST, rest || 'index.html') });
  });
}

const LIVE = {
  'tc-projects': ['Acme:Website', 'Garden'],
  'tc-entries': [{ type: 'i', datetime: '2024-01-01T09:00:00.000Z', account: 'Acme:Website' },
                 { type: 'o', datetime: '2024-01-01T10:00:00.000Z' }],
};

// Seed from a blank page on the same origin: if the app were running, its
// mount-time write-back could land after the seed and overwrite it (WebKit).
async function seedLive(page: Page) {
  await page.route('**/__seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('/__seed');
  await page.evaluate(data => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
  }, LIVE);
}

const storage = (page: Page) => page.evaluate(() => ({ ...localStorage }));

test('preview reads live data without copying it', async ({ page }) => {
  await servePreviews(page, [7]);
  await seedLive(page);
  await page.goto('/pr-preview/pr-7/');

  await expect(page.locator('.preview-banner')).toContainText('PR #7 preview');
  await expect(page.locator('.preview-banner')).toContainText('reading your live data');
  await expect(page.locator('.project-btn', { hasText: 'Garden' })).toBeVisible();

  const keys = Object.keys(await storage(page));
  expect(keys.filter(k => k.startsWith('preview:'))).toEqual([]);
});

test('first change in a preview forks; live data is untouched', async ({ page }) => {
  await servePreviews(page, [7]);
  await seedLive(page);
  await page.goto('/pr-preview/pr-7/');
  await page.locator('.project-btn', { hasText: 'Garden' }).click();

  await expect(page.locator('.preview-banner')).toContainText('editing a copy of your data');
  const s = await storage(page);
  expect(JSON.parse(s['tc-entries'])).toEqual(LIVE['tc-entries']);
  const copy = JSON.parse(s['preview:pr-7:tc-entries']);
  expect(copy).toHaveLength(3);
  expect(copy[2]).toMatchObject({ type: 'i', account: 'Garden' });
  expect(JSON.parse(s['preview:pr-7:tc-projects'])).toEqual(LIVE['tc-projects']);

  // Reload keeps reading the copy (still clocked in to Garden).
  await page.reload();
  await expect(page.locator('.status-account')).toHaveText('Garden');

  // Reset discards the copy and goes back to live.
  await page.locator('.preview-reset').click();
  await page.locator('.modal-confirm').click();
  await expect(page.locator('.preview-banner')).toContainText('reading your live data');
  expect(Object.keys(await storage(page)).filter(k => k.startsWith('preview:'))).toEqual([]);
});

test('copies for closed PR previews are removed', async ({ page }) => {
  await servePreviews(page, [7]);
  await seedLive(page);
  await page.evaluate(() => {
    localStorage.setItem('preview:pr-7:__forked', 'x');
    localStorage.setItem('preview:pr-7:tc-entries', '[]');
    localStorage.setItem('preview:pr-99:__forked', 'x');
    localStorage.setItem('preview:pr-99:tc-entries', '[]');
  });
  await page.goto('/');

  await expect.poll(async () => Object.keys(await storage(page)).filter(k => k.startsWith('preview:')).sort())
    .toEqual(['preview:pr-7:__forked', 'preview:pr-7:tc-entries']);
  expect(JSON.parse((await storage(page))['tc-entries'])).toEqual(LIVE['tc-entries']);
});
