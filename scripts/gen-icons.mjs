import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { deflateSync, inflateSync } from "node:zlib";

const directory = new URL("../public/icons/", import.meta.url);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function makeIcon(size) {
  const stride = size * 3 + 1;
  const pixels = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      // The E stays inside the central maskable safe circle.
      const stem = nx >= 0.28 && nx < 0.38 && ny >= 0.26 && ny < 0.74;
      const bar =
        nx >= 0.38 &&
        nx < 0.72 &&
        ((ny >= 0.26 && ny < 0.36) ||
          (ny >= 0.45 && ny < 0.55) ||
          (ny >= 0.64 && ny < 0.74));
      const color = stem || bar ? [255, 93, 115] : [11, 11, 16];
      const offset = y * stride + 1 + x * 3;
      pixels.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function validateIcon(png, size) {
  assert.deepEqual(png.subarray(0, 8), signature);
  const types = [];
  const imageData = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    assert.equal(
      png.readUInt32BE(offset + 8 + length),
      crc32(png.subarray(offset + 4, offset + 8 + length)),
    );
    types.push(type);
    if (type === "IHDR") {
      assert.equal(data.readUInt32BE(0), size);
      assert.equal(data.readUInt32BE(4), size);
      assert.deepEqual([...data.subarray(8)], [8, 2, 0, 0, 0]);
    }
    if (type === "IDAT") imageData.push(data);
    offset += length + 12;
  }
  assert.equal(offset, png.length);
  assert.deepEqual(types, ["IHDR", "IDAT", "IEND"]);
  const pixels = inflateSync(Buffer.concat(imageData));
  assert.equal(pixels.length, size * (size * 3 + 1));
  for (let y = 0; y < size; y++) assert.equal(pixels[y * (size * 3 + 1)], 0);
}

await mkdir(directory, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const destination = new URL(name, directory);
  await writeFile(destination, makeIcon(size));
  validateIcon(await readFile(destination), size);
}
console.log("Generated and validated 4 PNG icons.");
