import { expect, test } from "@playwright/test";

// Generate baselines with --project=visual --update-snapshots; CI also needs VISUAL_TESTS=1.
const pages = [
  { path: "/", name: "home" },
  { path: "/tv-time-alternative", name: "tv-time-alternative" },
  { path: "/import-tv-time-data", name: "import-tv-time-data" },
  { path: "/pricing", name: "pricing" },
  { path: "/app?demo=1", name: "app" },
  { path: "/app/discover?demo=1", name: "discover" },
  { path: "/app/import?demo=1", name: "import" },
  { path: "/app/library?demo=1", name: "library" },
  { path: "/app/calendar?demo=1", name: "calendar" },
  { path: "/app/stats?demo=1", name: "stats" },
  { path: "/app/profile?demo=1", name: "profile" },
];

for (const width of [375, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${width}px ${theme}`, { tag: "@visual" }, () => {
      test.use({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });

      test.beforeEach(async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "visual", "Visual project only");
        await page.addInitScript((selectedTheme) => {
          document.addEventListener("DOMContentLoaded", () => {
            document.documentElement.dataset.theme = selectedTheme;
          });
        }, theme);
      });

      for (const { path, name } of pages) {
        test(name, async ({ page }) => {
          const response = await page.goto(path, { waitUntil: "load" });
          expect(response?.ok()).toBe(true);
          await page.evaluate(async (selectedTheme) => {
            document.documentElement.dataset.theme = selectedTheme;
            await document.fonts.ready;
          }, theme);
          await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            theme,
          );
          await expect(page).toHaveScreenshot(`${name}-${width}-${theme}.png`, {
            fullPage: true,
            animations: "disabled",
            caret: "hide",
            maxDiffPixelRatio: 0.02,
          });
        });
      }
    });
  }
}
