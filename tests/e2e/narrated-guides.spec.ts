import { test, expect } from '@playwright/test';

test('each role and language loads its own playable narration and transcript', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/how-to-use?role=buyer&audio=en');
  for (const role of ['buyer', 'seller']) {
    await page.getByRole('tab', { name: role === 'buyer' ? 'Buyer' : 'Seller', exact: true }).click();
    for (const language of ['en', 'hi', 'gu']) {
      await page.locator('[data-guide-audio-language]').selectOption(language);
      const video = page.locator('[data-narrated-guide] video');
      await expect(video).toHaveAttribute('src', `/guides/${role}-${language}.mp4`);
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(1);
      expect(await video.evaluate((element: HTMLVideoElement) => element.duration)).toBeGreaterThan(60);
      expect(await video.evaluate((element: HTMLVideoElement) => element.error)).toBeNull();
      await video.evaluate((element: HTMLVideoElement) => { element.muted = true; return element.play(); });
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
      await video.evaluate((element: HTMLVideoElement) => element.pause());
      await expect(video.locator('track')).toHaveAttribute('srclang', language);
      await page.locator('[data-narrated-guide] summary').click();
      const transcript = page.locator('[data-narrated-guide] ol');
      await expect(transcript).toBeVisible();
      expect(await transcript.locator('li').count()).toBe(role === 'buyer' ? 7 : 8);
      if (language === 'hi') await expect(transcript).toContainText('फैब्रिक ट्रेड');
      if (language === 'gu') await expect(transcript).toContainText('ફેબ્રિક ટ્રેડ');
      await page.locator('[data-narrated-guide] summary').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    }
  }
  await page.reload();
  await expect(page.locator('[data-narrated-guide] video')).toHaveAttribute('src', '/guides/seller-gu.mp4');
});

test('an explicit audio choice survives a different saved website language', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fabrictrad:language', 'hi'));
  await page.goto('/how-to-use?role=seller&audio=gu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.locator('[data-guide-audio-language]')).toHaveValue('gu');
  await expect(page.locator('[data-narrated-guide] video')).toHaveAttribute('src', '/guides/seller-gu.mp4');
});
