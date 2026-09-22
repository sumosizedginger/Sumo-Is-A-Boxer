import { createServer } from "vite";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import zlib from "node:zlib";
import {createHash} from "node:crypto";


export function decodePNG(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  let pos = 8;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString("ascii");
    if (type === "IDAT") idats.push(buf.subarray(pos + 8, pos + 8 + len));
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
      } else if (colorType === 0) {
        pixels[(y * width + px) * 4 + 0] = raw;
        pixels[(y * width + px) * 4 + 1] = raw;
        pixels[(y * width + px) * 4 + 2] = raw;
        pixels[(y * width + px) * 4 + 3] = 255;
      }
    }
    prevRow = row;
  }
  return { width, height, channels: 4, data: pixels, pixels };
}

export function encodePNG(width, height, rgbaBuffer) {
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

export function compositeSideBySide(refImg, liveImg, refBox, label) {
  const targetH = 720;
  const targetW = 1280;
  const halfW = 640;
  const out = Buffer.alloc(targetW * targetH * 4, 0x28);
  for (let i = 3; i < out.length; i += 4) out[i] = 255;

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

  for (let y = 0; y < targetH; y++) {
    const idx = (y * targetW + halfW) * 4;
    out[idx] = 0x60; out[idx + 1] = 0x66; out[idx + 2] = 0x72;
  }

  return encodePNG(targetW, targetH, out);
}

function isDark(img, x, y, threshold = 100) {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return false;
  const idx = (y * img.width + x) * (img.channels || 4);
  if (img.data[idx + 3] < 100) return false;
  const lum = (img.data[idx] + img.data[idx + 1] + img.data[idx + 2]) / 3;
  return lum < threshold;
}

export function extractSilhouetteBounds(img, { xMin = 0, xMax = img.width - 1, yMin = 0, yMax = img.height - 1, minRowDark = 3 } = {}) {
  let actualMinY = 10000, actualMaxY = -1, actualMinX = 10000, actualMaxX = -1;
  for (let y = yMin; y <= yMax; y++) {
    let rowDark = 0;
    for (let x = xMin; x <= xMax; x++) {
      if (isDark(img, x, y)) rowDark++;
    }
    if (rowDark >= minRowDark) {
      if (y < actualMinY) actualMinY = y;
      if (y > actualMaxY) actualMaxY = y;
    }
  }

  if (actualMaxY < actualMinY) {
    throw new Error('No silhouette figure detected within search bounds');
  }

  for (let y = actualMinY; y <= actualMaxY; y++) {
    for (let x = xMin; x <= xMax; x++) {
      if (isDark(img, x, y)) {
        if (x < actualMinX) actualMinX = x;
        if (x > actualMaxX) actualMaxX = x;
      }
    }
  }

  const height = actualMaxY - actualMinY + 1;
  const width = actualMaxX - actualMinX + 1;
  const centerX = (actualMinX + actualMaxX) / 2;

  return { minY: actualMinY, maxY: actualMaxY, minX: actualMinX, maxX: actualMaxX, height, width, centerX };
}

export const ANATOMICAL_STATIONS = [
  { percent: 0,  name: 'crown' },
  { percent: 5,  name: 'cranium' },
  { percent: 8,  name: 'brow/forehead' },
  { percent: 10, name: 'eyes/orbit' },
  { percent: 12, name: 'nose/cheeks' },
  { percent: 14, name: 'mouth/chin' },
  { percent: 17, name: 'jaw/neck' },
  { percent: 20, name: 'trapezius' },
  { percent: 25, name: 'clavicles/deltoids' },
  { percent: 30, name: 'pectorals/upper_arms' },
  { percent: 35, name: 'chest/ribcage' },
  { percent: 40, name: 'upper_abdomen/elbows' },
  { percent: 45, name: 'central_belly/forearms' },
  { percent: 50, name: 'belly_apron/hands' },
  { percent: 55, name: 'pelvis/crotch' },
  { percent: 60, name: 'upper_thighs' },
  { percent: 65, name: 'mid_thighs' },
  { percent: 70, name: 'suprapatellar/knee' },
  { percent: 72, name: 'patella_center' },
  { percent: 75, name: 'infrapatellar' },
  { percent: 80, name: 'calf_gastrocnemius' },
  { percent: 85, name: 'lower_calf_taper' },
  { percent: 90, name: 'ankles' },
  { percent: 95, name: 'calcaneus/midfoot' },
  { percent: 100, name: 'plantar_sole' }
];

export function sampleSilhouetteProfile(img, bounds, stations = ANATOMICAL_STATIONS) {
  const { minY, height, centerX } = bounds;
  const samples = [];

  for (const st of stations) {
    const y = Math.min(img.height - 1, Math.max(0, Math.round(minY + height * (st.percent / 100))));
    let x0 = 10000, x1 = -1;
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (isDark(img, x, y)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
    const widthPx = x1 >= x0 ? x1 - x0 + 1 : 0;
    const ratioToH = widthPx / height;
    const leftExtent = x1 >= x0 ? (centerX - x0) / height : 0;
    const rightExtent = x1 >= x0 ? (x1 - centerX) / height : 0;
    samples.push({
      percent: st.percent,
      name: st.name,
      y,
      x0: x0 <= x1 ? x0 : 0,
      x1: x0 <= x1 ? x1 : 0,
      widthPx,
      ratioToH,
      leftExtent,
      rightExtent
    });
  }

  return samples;
}

export function compareSilhouettes({ refImg, refBounds, liveImg, liveBounds, viewType = 'front' }) {
  const refSamples = sampleSilhouetteProfile(refImg, refBounds);
  const liveSamples = sampleSilhouetteProfile(liveImg, liveBounds);

  const refAspect = refBounds.width / refBounds.height;
  const liveAspect = liveBounds.width / liveBounds.height;
  const aspectDiff = liveAspect - refAspect;

  const stationDeltas = [];
  let sumAbsDiff = 0;

  for (let i = 0; i < refSamples.length; i++) {
    const r = refSamples[i];
    const l = liveSamples[i];
    const diff = l.ratioToH - r.ratioToH;
    const absDiff = Math.abs(diff);
    sumAbsDiff += absDiff;
    stationDeltas.push({
      percent: r.percent,
      name: r.name,
      refRatio: r.ratioToH,
      liveRatio: l.ratioToH,
      diff,
      absDiff
    });
  }

  const meanError = sumAbsDiff / refSamples.length;
  const sortedByError = [...stationDeltas].sort((a, b) => b.absDiff - a.absDiff);

  const findSt = pct => stationDeltas.find(s => s.percent === pct);
  const headRatio = findSt(10)?.liveRatio ?? 0;
  const shoulderRatio = findSt(25)?.liveRatio ?? 0;
  const bellyRatio = findSt(45)?.liveRatio ?? 0;
  const hipRatio = findSt(55)?.liveRatio ?? 0;
  const thighRatio = findSt(65)?.liveRatio ?? 0;
  const kneeRatio = findSt(72)?.liveRatio ?? 0;
  const calfRatio = findSt(80)?.liveRatio ?? 0;
  const ankleRatio = findSt(90)?.liveRatio ?? 0;
  const footRatio = findSt(100)?.liveRatio ?? 0;

  return {
    viewType,
    refAspect,
    liveAspect,
    aspectDiff,
    meanError,
    headRatio,
    shoulderRatio,
    bellyRatio,
    hipRatio,
    thighRatio,
    kneeRatio,
    calfRatio,
    ankleRatio,
    footRatio,
    largestErrors: sortedByError.slice(0, 5),
    stationDeltas
  };
}

export function printComparisonReport(result) {
  console.log(`\n============================================================`);
  console.log(`SILHOUETTE COMPARISON REPORT: ${result.viewType.toUpperCase()}`);
  console.log(`============================================================`);
  console.log(`Overall Aspect Ratio: Reference=${result.refAspect.toFixed(3)}, Live=${result.liveAspect.toFixed(3)} (Delta=${(result.aspectDiff >= 0 ? '+' : '') + result.aspectDiff.toFixed(3)})`);
  console.log(`Mean Normalized Silhouette Error: ${(result.meanError * 100).toFixed(2)}% of character height`);
  console.log(`\nKey Anatomical Metrics (Live vs Reference):`);
  console.log(`  Head (p=10%):      ${result.headRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===10).refRatio.toFixed(3)}`);
  console.log(`  Shoulders (p=25%): ${result.shoulderRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===25).refRatio.toFixed(3)}`);
  console.log(`  Belly (p=45%):     ${result.bellyRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===45).refRatio.toFixed(3)}`);
  console.log(`  Hips (p=55%):      ${result.hipRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===55).refRatio.toFixed(3)}`);
  console.log(`  Thighs (p=65%):    ${result.thighRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===65).refRatio.toFixed(3)}`);
  console.log(`  Knees (p=72%):     ${result.kneeRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===72).refRatio.toFixed(3)}`);
  console.log(`  Calves (p=80%):    ${result.calfRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===80).refRatio.toFixed(3)}`);
  console.log(`  Ankles (p=90%):    ${result.ankleRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===90).refRatio.toFixed(3)}`);
  console.log(`  Foot/Sole (p=100%):${result.footRatio.toFixed(3)} vs ${result.stationDeltas.find(s=>s.percent===100).refRatio.toFixed(3)}`);
  console.log(`\nTop 5 Largest Local Discrepancies:`);
  for (const err of result.largestErrors) {
    const sign = err.diff >= 0 ? '+' : '';
    console.log(`  p=${String(err.percent).padStart(3)}% [${err.name}]: Live=${err.liveRatio.toFixed(3)}, Ref=${err.refRatio.toFixed(3)}, Err=${sign}${(err.diff * 100).toFixed(2)}%`);
  }
}

export async function runCaptures() {
  const directory = "artifacts/voxel-hero-003";
  mkdirSync(directory, { recursive: true });

  const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
  let puppeteer;
  try {
    puppeteer = (await import("puppeteer-core")).default;
  } catch {
    puppeteer = (await import("../engine/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js")).default;
  }

  const server = await createServer({
    server: { host: "127.0.0.1", port: 5188 }
  });
  await server.listen();
  const address = server.httpServer.address();
  const actualPort = typeof address === 'object' && address ? address.port : 5188;

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--use-gl=angle"]
  });

  const captures = [];
  try {
    const page = await browser.newPage();
    page.setViewport({ width: 1280, height: 720 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message)));
    page.on("console", (msg) => {
      const text = msg.text();
      if (!text.includes("Download the React DevTools")) {
        console.log("browser:", text);
      }
    });

    console.log(`Loading http://127.0.0.1:${actualPort}/?validation=voxel ...`);
    await page.goto(`http://127.0.0.1:${actualPort}/?validation=voxel`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForFunction(() => window.__SUMO_IS_A_BOXER__?.validation || document.querySelector("pre"), { timeout: 180000 });
    const bootFailed = await page.evaluate(() => document.querySelector("pre")?.textContent || null);
    if (bootFailed) throw new Error(bootFailed);

    const metrics = await page.evaluate(() => window.__SUMO_IS_A_BOXER__.validation.voxel.metrics());
    console.log("Voxel Hero Metrics:", JSON.stringify(metrics, null, 2));

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
      ["close-belly", "close_belly"],
      ["close-pelvis", "close_pelvis"],
      ["close-hand", "close_hand"],
      ["close-thigh-knee", "close_thigh_knee"],
      ["close-foot", "close_foot"],

      // PRODUCTION (26)
      ["hero-production", "hero_production"]
    ];

    const rawImages = new Map();
    for (const [name, preset] of views) {
      await page.evaluate((p) => window.__SUMO_IS_A_BOXER__.validation.applyPreset(p), preset);
      await new Promise((r) => setTimeout(r, 250));
      const file = join(directory, `${name}.png`);
      const buf = await page.screenshot({ path: file, type: "png" });
      captures.push(file);
      rawImages.set(name, decodePNG(buf));
      console.log(`Captured ${name}.png`);
    }

    const comparisons = [
      ["comparison-front-guide", "references/visual/02-silhouette.png", [8, 195, 190, 330], "guide-front"],
      ["comparison-front-voxel", "references/visual/02-silhouette.png", [8, 195, 190, 330], "clay-front"],
      ["comparison-profile-guide", "references/visual/02-silhouette.png", [386, 195, 115, 330], "guide-profile"],
      ["comparison-profile-voxel", "references/visual/02-silhouette.png", [386, 195, 115, 330], "clay-profile"],
      ["comparison-three-quarter-voxel", "references/visual/02-silhouette.png", [650, 195, 185, 330], "clay-three-quarter-front"]
    ];

    const refTurn = decodePNG(readFileSync("references/visual/02-silhouette.png"));

    for (const [compName, , box, liveName] of comparisons) {
      const liveImg = rawImages.get(liveName);
      if (liveImg) {
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
      capturesCount: allCaptures.length,
      captures: allCaptures
    };

    writeFileSync(join(directory, "metrics.json"), JSON.stringify({ metrics, errors, capturesCount: allCaptures.length, captures }, null, 2));
    writeFileSync(join(directory, "MANIFEST.json"), JSON.stringify(manifest, null, 2));
    await browser.close();
    await server.close();
  } catch (err) {
    await browser.close();
    await server.close();
    throw err;
  }
}

export async function runComparisons() {
  const refPath = 'references/visual/02-silhouette.png';
  const refBuf = readFileSync(refPath);
  const refImg = decodePNG(refBuf);

  const liveFrontPath = 'artifacts/voxel-hero-003/silhouette-front.png';
  const liveProfilePath = 'artifacts/voxel-hero-003/silhouette-profile.png';

  let frontRes = null;
  let profRes = null;

  try {
    const frontRefBounds = extractSilhouetteBounds(refImg, { xMin: 8, xMax: 197, yMin: 140, yMax: 525 });
    const frontLiveBuf = readFileSync(liveFrontPath);
    const frontLiveImg = decodePNG(frontLiveBuf);
    const frontLiveBounds = extractSilhouetteBounds(frontLiveImg);
    frontRes = compareSilhouettes({ refImg, refBounds: frontRefBounds, liveImg: frontLiveImg, liveBounds: frontLiveBounds, viewType: 'front' });
    printComparisonReport(frontRes);
  } catch (e) {
    console.warn('Could not run front comparison:', e.message);
  }

  try {
    const profRefBounds = extractSilhouetteBounds(refImg, { xMin: 386, xMax: 498, yMin: 140, yMax: 525 });
    const profLiveBuf = readFileSync(liveProfilePath);
    const profLiveImg = decodePNG(profLiveBuf);
    const profLiveBounds = extractSilhouetteBounds(profLiveImg);
    profRes = compareSilhouettes({ refImg, refBounds: profRefBounds, liveImg: profLiveImg, liveBounds: profLiveBounds, viewType: 'profile' });
    printComparisonReport(profRes);
  } catch (e) {
    console.warn('Could not run profile comparison:', e.message);
  }

  return { frontRes, profRes };
}

async function main() {
  const shouldCapture = !process.argv.includes('--no-capture') && !process.argv.includes('--measure-only');
  if (shouldCapture) {
    console.log("Starting browser capture for VOXEL-HERO-003...");
    await runCaptures();
  }
  console.log("Running silhouette comparison against approved reference...");
  const results=await runComparisons();
  if(!results.frontRes||!results.profRes)throw new Error("Both fresh silhouette captures are required");
  const inputPaths=["references/visual/02-silhouette.png","artifacts/voxel-hero-003/silhouette-front.png","artifacts/voxel-hero-003/silhouette-profile.png"];
  writeFileSync("artifacts/voxel-hero-003/silhouette-metrics.json",JSON.stringify({
    inputs:inputPaths.map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")})),
    frontPercent:results.frontRes.meanError*100,profilePercent:results.profRes.meanError*100,...results
  },null,2));
}

const isDirectRun = !process.env.TEST_IMPORT && (
  process.argv[1] && (
    process.argv[1].endsWith('measure-silhouette.mjs') ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
  )
);

if (isDirectRun) {
  main().catch((err) => {
    console.error("Failure in measure-silhouette:", err);
    process.exit(1);
  });
}
