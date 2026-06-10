import { test, expect } from '@playwright/test';

test('visual regression verification', async ({ page }) => {
  // Add init script to mock Date BEFORE the page loads and runs JS
  await page.addInitScript(() => {
    const OriginalDate = window.Date;
    class MockDate extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super('2024-01-01T12:00:00Z');
        } else {
          super(...args as []);
        }
      }
    }
    // Copy static methods
    MockDate.now = () => new OriginalDate('2024-01-01T12:00:00Z').getTime();
    MockDate.parse = OriginalDate.parse;
    MockDate.UTC = OriginalDate.UTC;

    (window as any).Date = MockDate;
  });

  await page.goto('/');

  // Wait for React app to mount
  await page.waitForSelector('.app');

  // Wait a small amount for any state initialization ticks
  await page.waitForTimeout(500);

  // Assert screenshot
  await expect(page).toHaveScreenshot('app-initial-state.png', { fullPage: true });
});
