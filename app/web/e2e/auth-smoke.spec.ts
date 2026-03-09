import { expect, test } from '@playwright/test';

test.describe('auth smoke', () => {
  test('shows sign in form for unauthenticated users', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.locator('button[type="submit"]', { hasText: 'Login' })).toBeVisible();
  });

  test('validates register password mismatch on client side', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByLabel('Email', { exact: true }).fill('e2e@example.com');
    await page.getByLabel('Password', { exact: true }).fill('strongpass');
    await page.getByLabel('Confirm password', { exact: true }).fill('differentpass');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Passwords do not match.')).toBeVisible();
  });
});
