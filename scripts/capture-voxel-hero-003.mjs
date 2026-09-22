import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import zlib from "node:zlib";

const directory = process.env.CAPTURE_DIR ?? "artifacts/voxel-hero-003";
mkdirSync(directory, { recursive: true });

const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  puppeteer = (await import("../engine/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).default;
}

// Minimal PNG decoder and encoder for side-by-side comparison board generation
function decodePNG(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  let pos = 8;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.slice(pos + 4, pos + 8).toString("ascii");
    if (type === "IDAT") idats.push(buf.slice(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bpp + 1;
  const pixels = Buffer.alloc(width * height * 4);
  let prevRow = Buffer.alloc(width * bpp);
  for (let y = 0; y < height; y++) {
    const filter = decompressed[y * stride];
    const row = Buffer.alloc(width * bpp);
    for (let i = 0; i < width * bpp; i++) {
      const val = decompressed[y * stride + 1 + i];
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;
      let raw = 0;
      if (filter === 0) raw = val;
      else if (filter === 1) raw = (val + a) & 255;
      else if (filter === 2) raw = (val + b) & 255;
      else if (filter === 3) raw = (val + Math.floor((a + b) / 2)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        raw = (val + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 255;
      }
      row[i] = raw;
      const px = Math.floor(i / bpp), ch = i % bpp;
      if (colorType === 2) {
        pixels[(y * width + px) * 4 + ch] = raw;
        pixels[(y * width + px) * 4 + 3] = 255;
      } else if (colorType === 6) {
        pixels[(y * width + px) * 4 + ch] = raw;
      }
    }
    prevRow = row;
  }
  return { width, height, pixels };
}

function encodePNG(width, height, rgbaBuffer) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgbaBuffer.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw);
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c;
  }
  function crc32(buf, start, len) {
    let c = 0xffffffff;
    for (let i = start; i < start + len; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function makeChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(12 + len);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, "ascii");
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(chunk, 4, 4 + len), 8 + len);
    return chunk;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

function compositeSideBySide(refImg, liveImg, refBox, label) {
  const targetH = 720;
  const targetW = 1280;
  const halfW = 640;
  const out = Buffer.alloc(targetW * targetH * 4, 0x28); // dark background
  for (let i = 3; i < out.length; i += 4) out[i] = 255;

  // Blit live image on right half (center-cropped from 1280x720)
  const cropStartX = Math.floor((liveImg.width - halfW) / 2);
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < halfW; x++) {
      const srcX = cropStartX + x;
      const srcY = y;
      const srcIdx = (srcY * liveImg.width + srcX) * 4;
      const dstIdx = (y * targetW + (x + halfW)) * 4;
      out[dstIdx] = liveImg.pixels[srcIdx];
      out[dstIdx + 1] = liveImg.pixels[srcIdx + 1];
      out[dstIdx + 2] = liveImg.pixels[srcIdx + 2];
      out[dstIdx + 3] = 255;
    }
  }

  // Crop & scale reference figure on left half
  const [rx0, ry0, rw, rh] = refBox;
  const scale = Math.min((halfW * 0.85) / rw, (targetH * 0.85) / rh);
  const drawW = Math.floor(rw * scale);
  const drawH = Math.floor(rh * scale);
  const offX = Math.floor((halfW - drawW) / 2);
  const offY = Math.floor((targetH - drawH) / 2);

  for (let dy = 0; dy < drawH; dy++) {
    for (let dx = 0; dx < drawW; dx++) {
      const sx = rx0 + Math.floor(dx / scale);
      const sy = ry0 + Math.floor(dy / scale);
      if (sx >= 0 && sx < refImg.width && sy >= 0 && sy < refImg.height) {
        const srcIdx = (sy * refImg.width + sx) * 4;
        const dstIdx = ((offY + dy) * targetW + (offX + dx)) * 4;
        out[dstIdx] = refImg.pixels[srcIdx];
        out[dstIdx + 1] = refImg.pixels[srcIdx + 1];
        out[dstIdx + 2] = refImg.pixels[srcIdx + 2];
        out[dstIdx + 3] = 255;
      }
    }
  }

  // Draw dividing line
  for (let y = 0; y < targetH; y++) {
    const idx = (y * targetW + halfW) * 4;
    out[idx] = 0x60; out[idx + 1] = 0x66; out[idx + 2] = 0x72;
  }

  return encodePNG(targetW, targetH, out);
}

const server = await createServer({ server: { host: "127.0.0.1", port: 5188, strictPort: true } });
await server.listen();
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--use-gl=angle"]
});

const captures = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (msg) => console.log("browser", msg.type(), msg.text()));

  await page.goto("http://127.0.0.1:5188/?validation=voxel&realization="+(process.env.REALIZATION??"surface"), { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__SUMO_IS_A_BOXER__?.validation || document.querySelector("pre"), { timeout: 180000 });
  const bootFailed = await page.evaluate(() => document.querySelector("pre")?.textContent || null);
  if (bootFailed) throw new Error(bootFailed);

  const metrics = await page.evaluate(() => window.__SUMO_IS_A_BOXER__.validation.voxel.metrics());

  const views = [
    // GUIDE (1 - 5)
    ["guide-front", "guide_front"],
    ["guide-rear", "guide_rear"],
    ["guide-profile", "guide_profile"],
    ["guide-three-quarter-front", "guide_three_quarter_front"],
    ["guide-three-quarter-rear", "guide_three_quarter_rear"],

    // VOXEL CLAY (6 - 10)
    ["clay-front", "clay_front"],
    ["clay-rear", "clay_rear"],
    ["clay-profile", "clay_profile"],
    ["clay-three-quarter-front", "clay_three_quarter_front"],
    ["clay-three-quarter-rear", "clay_three_quarter_rear"],

    // SILHOUETTE (11 - 12)
    ["silhouette-front", "silhouette_front"],
    ["silhouette-profile", "silhouette_profile"],

    // CLOSEUPS (13 - 20)
    ["close-head", "close_head"],
    ["close-face", "close_face"],
    ["close-shoulder", "close_shoulder"],
    ["close-chest", "close_chest"],
    ["close-calf", "close_calf"],
    ["close-belly", "close_belly"],
    ["close-pelvis", "close_pelvis"],
    ["close-hand", "close_hand"],
    ["close-thigh-knee", "close_thigh_knee"],
    ["close-foot", "close_foot"],

    // PRODUCTION (26)
    ["hero-production", "hero_production"]
  ];

  views.push(...views.filter(([n])=>n.startsWith('close-')).map(([n,p])=>['guide-'+n,'guide_'+p]));
  const filter = process.argv[2];
  if(filter==='bind') views.push(...['front','rear','profile'].map(v=>['bind-'+v,'bind_'+v]));
  const activeViews = filter ? views.filter(([n, p]) => filter.split(",").some(f=>f.startsWith("=")?n===f.slice(1):n.includes(f) || p.includes(f))) : views;

  if (!activeViews.length) throw new Error("Capture filter matches no views: "+filter);
  const rawImages = new Map();
  for (const [name, preset] of activeViews) {
    await page.evaluate((p) => window.__SUMO_IS_A_BOXER__.validation.applyPreset(p), preset);
    await new Promise((r) => setTimeout(r, 200));
    const file = join(directory, `${name}.png`);
    const buf = await page.screenshot({ path: file, type: "png" });
    captures.push(file);
    rawImages.set(name, decodePNG(buf));
    console.log(`Captured ${name}.png`);
  }

  // Load Reference Sheets for Comparisons (21 - 25)
  // Reference 02-silhouette: Turnaround sheet (1024 x 768)
  // Front: [8, 205, 190, 343]
  // Profile: [386, 205, 113, 343]
  // 3/4: [651, 205, 184, 343]
  const comparisons = [
    ["comparison-front-guide", "references/visual/02-silhouette.png", [8, 190, 190, 370], "guide-front"],
    ["comparison-front-voxel", "references/visual/02-silhouette.png", [8, 190, 190, 370], "clay-front"],
    ["comparison-profile-guide", "references/visual/02-silhouette.png", [386, 190, 120, 370], "guide-profile"],
    ["comparison-profile-voxel", "references/visual/02-silhouette.png", [386, 190, 120, 370], "clay-profile"],
    ["comparison-three-quarter-voxel", "references/visual/02-silhouette.png", [651, 190, 185, 370], "clay-three-quarter-front"]
  ];

  if (!filter) {
    const refTurn = decodePNG(readFileSync("references/visual/02-silhouette.png"));

    for (const [compName, , box, liveName] of comparisons) {
      const liveImg = rawImages.get(liveName);
      const compBuf = compositeSideBySide(refTurn, liveImg, box, compName);
      const compFile = join(directory, `${compName}.png`);
      writeFileSync(compFile, compBuf);
      captures.push(compFile);
      console.log(`Composited ${compName}.png`);
    }
  }

  const allCaptures = [
    ...views.map(([n]) => `${n}.png`),
    ...comparisons.map(([n]) => `${n}.png`)
  ];

  const manifest = {
    milestone: "VOXEL-HERO-003",
    branch: "game-build",
    quality: "HERO",
    hero: metrics,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(),
    sourceHashes: Object.fromEntries([
      'src/game/character/continuous-body.js','src/game/character/sumo-body-sculpt.js',
      'src/game/character/head-profile.js','src/game/character/hero-face.js','src/game/character/orbital-pockets.js',
      'src/game/voxel/hero-voxel.js','engine/src/voxel/coherent-surface.js','engine/src/voxel/surface-frame.js',
      'engine/src/voxel/surface-instances.js','engine/src/voxel/runtime.js',
      'src/game/validation/presets.js','src/game/validation/harness.js'
    ].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')])),
    sourceDiffHash: createHash("sha256").update(execFileSync("git", ["diff", "HEAD", "--", "src", "engine/src", "scripts"])).digest("hex"),
    filter: filter ?? null,
    complete: !filter,
    capturesCount: captures.length,
    expectedCaptures: allCaptures,
    captures: captures.map(file=>basename(file)),
    evidence: captures.map(file=>({file:basename(file),sha256:createHash("sha256").update(readFileSync(file)).digest("hex")}))
  };

  writeFileSync(join(directory, "metrics.json"), JSON.stringify({ metrics, errors, capturesCount: captures.length, captures }, null, 2));
  writeFileSync(join(directory, "MANIFEST.json"), JSON.stringify(manifest, null, 2));
  console.log("Generated", captures.length, "captures; complete set:", !filter);
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
