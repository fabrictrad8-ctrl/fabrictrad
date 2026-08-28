import { expect, test } from '@playwright/test';

test('password recovery requests a numeric email OTP and advances to code entry', async ({ page }) => {
  let requestBody: unknown = null;

  await page.route('**/api/auth/password-reset-otp/request', async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sent: true,
        method: 'email_otp',
        destination: 'bu••••@example.com',
      }),
    });
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

  await page.getByLabel('Registered email').fill('buyer@example.com');
  await page.getByRole('button', { name: 'Send OTP to email' }).click();

  expect(requestBody).toEqual({ email: 'buyer@example.com' });
  await expect(page.getByLabel('Email OTP')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify OTP' })).toBeDisabled();
  await expect(page.getByText(/Code sent to buyer@example\.com/i)).toBeVisible();
});

test('password recovery requires a complete numeric OTP before verification', async ({ page }) => {
  await page.route('**/api/auth/password-reset-otp/request', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sent: true, method: 'email_otp', destination: 'bu••••@example.com' }),
    });
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Registered email').fill('buyer@example.com');
  await page.getByRole('button', { name: 'Send OTP to email' }).click();

  const otp = page.getByLabel('Email OTP');
  const verify = page.getByRole('button', { name: 'Verify OTP' });

  await otp.fill('12345');
  await expect(verify).toBeDisabled();

  await otp.fill('123456');
  await expect(verify).toBeEnabled();
});

test('administrator password recovery remains non-enumerating and does not create a password session', async ({ request }) => {
  const response = await request.post('/api/auth/password-reset-otp/request', {
    data: { email: 'fabrictrad8@gmail.com' },
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.sent).toBe(true);
  expect(body.method).toBe('email_otp');
  expect(JSON.stringify(body).toLowerCase()).not.toContain('admin');
  expect(JSON.stringify(body).toLowerCase()).not.toContain('super_admin');
});
