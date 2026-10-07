import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const defaultPaths = [
  "/",
  "/tv-time-alternative",
  "/import-tv-time-data",
  "/pricing",
  "/app",
  "/app/discover",
  "/app/import",
  "/app/library",
  "/app/calendar",
  "/app/stats",
  "/app/profile",
];

async function main() {
  const [baseUrl, outDir, pathsArg, widthsArg, themesArg, ...extra] =
    process.argv.slice(2);
  if (!baseUrl || !outDir || extra.length) {
    throw new Error(
      "Usage: node scripts/shots.mjs <baseUrl> <outDir> [comma-separated paths] [widths=375,768,1280,1920] [themes=light,dark]",
    );
  }

  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol)) {
    throw new Error("baseUrl must use HTTP or HTTPS");
  }
  const paths = pathsArg ? pathsArg.split(",") : defaultPaths;
  const widthValues = (widthsArg ?? "375,768,1280,1920")
    .replace(/^widths=/, "")
    .split(",");
  const widths = widthValues.map(Number);
  if (
    widthValues.some((value) => !/^\d+$/.test(value)) ||
    widths.some((width) => !Number.isSafeInteger(width) || width < 1)
  ) {
    throw new Error("Widths must be positive integers");
  }
  const themes = (themesArg ?? "light,dark").replace(/^themes=/, "").split(",");
  if (themes.some((theme) => theme !== "light" && theme !== "dark")) {
    throw new Error("Themes must be light or dark");
  }
  const urls = paths.map((path) => {
    const url = new URL(path, base);
    if (!path.startsWith("/") || url.origin !== base.origin) {
      throw new Error(`Expected a same-origin absolute path: ${path}`);
    }
    // App versions with demo support seed their library; others ignore this flag.
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
      url.searchParams.set("demo", "1");
    }
    return url;
  });

  const output = resolve(outDir);
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [index, url] of urls.entries()) {
      for (const width of widths) {
        for (const theme of themes) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme: theme,
            reducedMotion: "reduce",
            deviceScaleFactor: 1,
          });
          try {
            await context.addInitScript((selectedTheme) => {
              document.addEventListener("DOMContentLoaded", () => {
                document.documentElement.dataset.theme = selectedTheme;
              });
            }, theme);
            const page = await context.newPage();
            page.setDefaultTimeout(30_000);
            const response = await page.goto(url.href, {
              waitUntil: "load",
            });
            if (!response?.ok()) {
              throw new Error(`HTTP ${response?.status() ?? "no response"}`);
            }
            await page.evaluate(async (selectedTheme) => {
              document.documentElement.dataset.theme = selectedTheme;
              await document.fonts.ready;
            }, theme);
            const slug =
              url.pathname
                .replace(/[^a-zA-Z0-9_-]+/g, "-")
                .replace(/^-|-$/g, "") || "home";
            const filename = `${index + 1}-${slug}-${width}-${theme}.png`;
            await page.screenshot({
              path: resolve(output, filename),
              fullPage: true,
              animations: "disabled",
              caret: "hide",
            });
            console.log(filename);
          } catch (error) {
            throw new Error(
              `Capture failed: ${url.href} (${width}, ${theme})`,
              {
                cause: error,
              },
            );
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
