import { test, expect, type Page } from '@playwright/test';

// Adding/fixing sessions, undo, the forgotten-clock-out prompt and Gist sync.

test.use({ serviceWorkers: 'block' });

// Seed from a blank page on the same origin so the app's mount-time
// write-back can't race the seed (see preview.spec.ts).
async function seed(page: Page, data: Record<string, unknown>) {
  await page.route('**/__seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('/__seed');
  await page.evaluate(d => {
    localStorage.clear();
    for (const [k, v] of Object.entries(d)) localStorage.setItem(k, JSON.stringify(v));
  }, data);
}

const entries = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('tc-entries') || '[]'));

const PROJECTS = { 'tc-projects': ['Acme:Website', 'Garden'] };

test('add a past session from the Log tab, rejecting overlaps', async ({ page }) => {
  await seed(page, PROJECTS);
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'Log' }).click();

  await page.getByRole('button', { name: /Add entry/ }).click();
  await page.locator('#edit-account').selectOption('Garden');
  await page.locator('#edit-date').fill('2024-03-05');
  await page.locator('#edit-end-date').fill('2024-03-05');
  await page.locator('#edit-start-time').fill('09:00');
  await page.locator('#edit-end-time').fill('10:30');
  await page.getByRole('button', { name: 'Save' }).click();

  const day = page.locator('.day-card', { hasText: 'Mar 5' });
  await expect(day.locator('.day-total')).toHaveText('1h 30m');
  await expect(day).toContainText('Garden');

  // Overlapping the first one is refused with a message.
  await page.getByRole('button', { name: /Add entry/ }).click();
  await page.locator('#edit-date').fill('2024-03-05');
  await page.locator('#edit-end-date').fill('2024-03-05');
  await page.locator('#edit-start-time').fill('10:00');
  await page.locator('#edit-end-time').fill('11:00');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.form-error')).toContainText('Overlaps Garden');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await entries(page)).toHaveLength(2);
});

test('an edit can run past midnight', async ({ page }) => {
  await seed(page, { ...PROJECTS, 'tc-entries': [
    { type: 'i', datetime: new Date(2024, 2, 5, 22, 0).toISOString(), account: 'Garden' },
    { type: 'o', datetime: new Date(2024, 2, 5, 23, 0).toISOString() },
  ] });
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'Log' }).click();
  await page.getByRole('button', { name: 'Edit session' }).click();
  await page.locator('#edit-end-time').fill('01:15');
  await expect(page.locator('.edit-label-note')).toContainText('next day');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.day-total')).toHaveText('3h 15m');
});

test('editing a multi-day session keeps its end date', async ({ page }) => {
  await seed(page, { ...PROJECTS, 'tc-entries': [
    { type: 'i', datetime: new Date(2024, 2, 4, 9, 0).toISOString(), account: 'Garden' },
    { type: 'o', datetime: new Date(2024, 2, 5, 10, 0).toISOString() },
  ] });
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'Log' }).click();
  await page.getByRole('button', { name: 'Edit session' }).click();
  await expect(page.locator('#edit-end-date')).toHaveValue('2024-03-05');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.day-total')).toHaveText('25h 00m');

  // Moving the start date carries the end date along.
  await page.getByRole('button', { name: 'Edit session' }).click();
  await page.locator('#edit-date').fill('2024-03-01');
  await expect(page.locator('#edit-end-date')).toHaveValue('2024-03-02');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.day-card', { hasText: 'Mar 1' }).locator('.day-total')).toHaveText('25h 00m');
});

test('delete and clock-in can be undone', async ({ page }) => {
  await seed(page, { ...PROJECTS, 'tc-entries': [
    { type: 'i', datetime: '2024-03-05T09:00:00.000Z', account: 'Garden' },
    { type: 'o', datetime: '2024-03-05T10:00:00.000Z' },
  ] });
  await page.goto('/');

  await page.locator('.project-btn', { hasText: 'Acme:Website' }).click();
  await expect(page.locator('.status-account')).toHaveText('Acme:Website');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.status-idle')).toBeVisible();
  expect(await entries(page)).toHaveLength(2);

  await page.locator('.nav-btn', { hasText: 'Log' }).click();
  await page.getByRole('button', { name: 'Delete session' }).click();
  await expect(page.locator('.day-card')).toHaveCount(0);
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.day-card')).toHaveCount(1);
});

test('a session left running overnight prompts to clock out earlier', async ({ page }) => {
  const start = new Date(Date.now() - 14 * 3600_000);
  await seed(page, { ...PROJECTS, 'tc-entries': [{ type: 'i', datetime: start.toISOString(), account: 'Garden' }] });
  await page.goto('/');

  await expect(page.locator('.modal-title')).toHaveText('Forgot to clock out?');
  const end = new Date(start.getTime() + 2 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  await page.locator('#clockout-date').fill(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`);
  await page.locator('#clockout-time').fill(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
  await page.getByRole('button', { name: 'Clock out', exact: true }).click();

  await expect(page.locator('.status-idle')).toBeVisible();
  const saved = await entries(page);
  expect(saved).toHaveLength(2);
  expect(new Date(saved[1].datetime).getTime() - start.getTime()).toBeLessThan(2 * 3600_000 + 60_000);
});

test('"Still working" dismisses the prompt for that session', async ({ page }) => {
  await seed(page, { ...PROJECTS, 'tc-entries': [
    { type: 'i', datetime: new Date(Date.now() - 11 * 3600_000).toISOString(), account: 'Garden' },
  ] });
  await page.goto('/');
  await page.getByRole('button', { name: 'Still working' }).click();
  await expect(page.locator('.modal')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.status-account')).toHaveText('Garden');
  await expect(page.locator('.modal')).toHaveCount(0);
  await expect(page.locator('.stale-note')).toBeVisible();
});

test('backup reminder appears for an old, never-backed-up log', async ({ page }) => {
  await seed(page, { ...PROJECTS, 'tc-entries': [
    { type: 'i', datetime: '2024-03-05T09:00:00.000Z', account: 'Garden' },
    { type: 'o', datetime: '2024-03-05T10:00:00.000Z' },
  ] });
  await page.goto('/');
  await expect(page.locator('.backup-nudge')).toContainText('Not backed up yet');
  await page.locator('.backup-nudge').getByRole('button', { name: 'Later' }).click();
  await expect(page.locator('.backup-nudge')).toHaveCount(0);
});

test('Gist sync creates a secret gist and pushes changes', async ({ page }) => {
  const calls: { method: string; body: { public?: boolean; files: Record<string, { content: string }> } }[] = [];
  await page.route('https://api.github.com/gists**', async route => {
    const req = route.request();
    expect(req.headers()['authorization']).toBe('Bearer ghp_test');
    calls.push({ method: req.method(), body: req.postDataJSON() });
    await route.fulfill({
      status: req.method() === 'POST' ? 201 : 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ id: 'abc123def456abc123def456', html_url: 'https://gist.github.com/abc123def456abc123def456' }),
    });
  });
  await seed(page, PROJECTS);
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'Projects' }).click();

  await page.getByLabel('GitHub token').fill('ghp_test');
  await page.getByRole('button', { name: 'Create secret gist' }).click();
  await expect(page.locator('.sync-status')).toContainText('gist abc123de');
  expect(calls[0]).toMatchObject({ method: 'POST', body: { public: false } });

  await page.locator('.nav-btn', { hasText: 'Clock' }).click();
  await page.locator('.project-btn', { hasText: 'Garden' }).click();
  await expect.poll(() => calls.length, { timeout: 10_000 }).toBe(2);
  expect(calls[1].method).toBe('PATCH');
  expect(calls[1].body.files['timeclock.journal'].content).toMatch(/^i \d{4}\/\d\d\/\d\d \d\d:\d\d Garden\n$/);
  expect(JSON.parse(calls[1].body.files['timeclock.json'].content).entries).toHaveLength(1);
});

test('connecting to an existing gist merges its data first', async ({ page }) => {
  const remote = {
    entries: [{ type: 'i', datetime: '2024-03-05T09:00:00.000Z', account: 'Remote:Job' },
              { type: 'o', datetime: '2024-03-05T10:00:00.000Z' }],
    projects: ['Remote:Job'],
    hiddenProjects: [],
  };
  await page.route('https://api.github.com/gists/**', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      id: 'abc123def456abc123def456',
      html_url: 'https://gist.github.com/abc123def456abc123def456',
      files: { 'timeclock.json': { content: JSON.stringify(remote), truncated: false } },
    }),
  }));
  await seed(page, PROJECTS);
  await page.goto('/');
  await page.locator('.nav-btn', { hasText: 'Projects' }).click();
  await page.getByLabel('GitHub token').fill('ghp_test');
  await page.getByLabel('Existing gist URL or ID').fill('https://gist.github.com/me/abc123def456abc123def456');
  await page.getByRole('button', { name: 'Connect & restore' }).click();

  await expect(page.locator('.toast')).toContainText('Restored 2 entries');
  expect(await entries(page)).toEqual(remote.entries);
  await page.locator('.nav-btn', { hasText: 'Clock' }).click();
  await expect(page.locator('.project-btn', { hasText: 'Remote:Job' })).toBeVisible();
});
