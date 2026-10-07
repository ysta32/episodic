import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const directory = new URL("public/icons/", root);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const tokens = await readFile(new URL("src/design/tokens.css", root), "utf8");
const darkTokens = tokens.match(
  /:root\[data-theme="dark"\]\s*\{([^}]+)\}/,
)?.[1];
assert.ok(darkTokens, "Dark Kinescope tokens must exist");
const ink = darkTokens.match(/--k-bg:\s*(#[\da-f]{6});/i)?.[1];
const amber = darkTokens.match(/--k-accent:\s*(#[\da-f]{6});/i)?.[1];
assert.ok(ink && amber, "Ink and amber must be defined in the dark palette");
const mark = await readFile(new URL("public/brand/mark.svg", root), "utf8");
assert.ok(mark.includes(`fill="${amber}"`), "Mark must use Kinescope amber");
const geometry = mark.match(/<path\b[^>]*\/>/)?.[0];
assert.ok(geometry, "Brand mark must contain its vector path");

function iconSvg(maskable = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-labelledby="title">
  <title id="title">Episodic</title>
  <path fill="${ink}" d="M0 0H64V64H0Z"/>
  <g${maskable ? ' transform="translate(4.8 4.8) scale(.85)"' : ""}>${geometry}</g>
</svg>\n`;
}

function validatePng(png, size) {
  assert.deepEqual(png.subarray(0, 8), signature, "Output must be PNG");
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), size, "PNG width");
  assert.equal(png.readUInt32BE(20), size, "PNG height");
}

await mkdir(directory, { recursive: true });
await writeFile(new URL("src/app/icon.svg", root), iconSvg());
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, maskable] of [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, false],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${iconSvg(maskable)}`,
    );
    const png = await page.screenshot({ type: "png" });
    validatePng(png, size);
    const pixels = await page.evaluate(
      async ({ encoded, size, ink, maskable }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${encoded}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D is unavailable");
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, size, size);
        const background = ink
          .match(/[\da-f]{2}/gi)
          .map((hex) => parseInt(hex, 16));
        let foreground = 0;
        let outsideSafeZone = 0;
        let transparent = 0;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const offset = (y * size + x) * 4;
            if (data[offset + 3] !== 255) transparent++;
            if (
              background.some(
                (value, channel) => data[offset + channel] !== value,
              )
            ) {
              foreground++;
              if (
                maskable &&
                Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * 0.4
              ) {
                outsideSafeZone++;
              }
            }
          }
        }
        return { foreground, outsideSafeZone, transparent };
      },
      { encoded: png.toString("base64"), size, ink, maskable },
    );
    assert.ok(pixels.foreground > size * size * 0.1, `${name}: visible mark`);
    assert.equal(pixels.outsideSafeZone, 0, `${name}: maskable safe circle`);
    assert.equal(pixels.transparent, 0, `${name}: opaque background`);
    await writeFile(new URL(name, directory), png);
    if (size === 180) {
      await writeFile(new URL("src/app/apple-icon.png", root), png);
    }
  }
  for (const name of [
    "logo.svg",
    "logo-mono.svg",
    "wordmark.svg",
    "mark.svg",
  ]) {
    const svg = await readFile(new URL(`public/brand/${name}`, root), "utf8");
    assert.ok(svg.startsWith("<svg"), `${name}: SVG asset exists`);
  }
  console.log(
    "PASS: 4 brand SVGs, favicon SVG, 5 PNGs; dimensions, opacity and maskable safe zone validated.",
  );
} finally {
  await browser.close();
}
