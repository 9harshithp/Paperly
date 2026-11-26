import { test, expect } from '@playwright/test';

test.describe('Paperly smoke tests', () => {
  test('loads game, renders canvas, and has no console errors or missing assets', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failedAssets = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 400) failedAssets.push(`${res.status()} ${res.url()}`);
    });

    await page.goto('/');
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#chapter-title')).toBeVisible();

    const heroCanvas = page.locator('#hero-plane canvas, #scene');
    await expect(heroCanvas.first()).toBeVisible();

    expect(failedAssets, `Failed assets: ${failedAssets.join(', ')}`).toEqual([]);
    expect(pageErrors, `Page errors: ${pageErrors.join(', ')}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join(', ')}`).toEqual([]);
  });

  test('chapter selection updates active chapter', async ({ page }) => {
    await page.goto('/');
    const initialTitle = await page.locator('#chapter-title').textContent();
    await page.locator('#cards > *').nth(1).click();
    const nextTitle = await page.locator('#chapter-title').textContent();
    expect(nextTitle).not.toEqual(initialTitle);

    await page.locator('#cards > *').nth(0).click();
    const prevTitle = await page.locator('#chapter-title').textContent();
    expect(prevTitle).toEqual(initialTitle);
  });

  test('flight controls, pause, and restart work', async ({ page }) => {
    await page.goto('/');
    await page.locator('#launch').click();

    await expect(page.locator('#flight')).toBeVisible();
    const worldCanvas = page.locator('#world canvas');
    await expect(worldCanvas).toBeVisible();
    const box = await worldCanvas.boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(100);

    // Exercise flight controls
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(200);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');

    // Pause via Escape
    await page.keyboard.press('Escape');
    const pauseOverlay = page.locator('#pause');
    await expect(pauseOverlay).toBeVisible();

    // Restart or resume from pause
    const restartBtn = page.locator('#pause button:has-text("Restart"), #restart');
    if (await restartBtn.count()) {
      await restartBtn.first().click();
      await expect(page.locator('#flight')).toBeVisible();
    }
  });

  test('hangar and aircraft selection', async ({ page }) => {
    await page.goto('/');
    await page.locator('#nav-hangar').click();
    await expect(page.locator('#nav-hangar')).toHaveClass(/on/);
    await expect(page.locator('#plane-caption')).toBeVisible();
  });
});
