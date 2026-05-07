import { test, expect } from '@playwright/test';

test('has application title', async ({ page }) => {
  // Go to the local dev server
  await page.goto('/');
  // Next.js standard or custom title logic usually renders "PORTFOLIO HCHPS"
  const title = await page.title();
  expect(title).toMatch(/VITAL Work Manager/i);
});
