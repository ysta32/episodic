import { expect, test } from "@playwright/test";

test("landing page loads with a heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("TV Time alternative page has an h1", async ({ page }) => {
  const response = await page.goto("/tv-time-alternative");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("app loads with Up Next navigation", async ({ page }) => {
  const response = await page.goto("/app");
  expect(response?.ok()).toBe(true);
  await expect(
    page
      .getByRole("link", { name: "Up Next", exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("web app manifest is served", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toMatch(
    /application\/(?:manifest\+json|json)/,
  );
  const manifest: unknown = await response.json();
  expect(manifest).toEqual(
    expect.objectContaining({ name: expect.any(String) }),
  );
});
