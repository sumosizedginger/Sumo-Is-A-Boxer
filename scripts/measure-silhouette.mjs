import { readFileSync } from "node:fs";
import zlib from "node:zlib";

function decodePNG(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  let pos = 8;
  const idats = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (type === "IDAT") {
      idats.push(buf.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idats));
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * channels;
  const data = Buffer.alloc(width * height * channels);
  let srcPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcPos++];
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawVal = decompressed[srcPos++];
      const left = x >= channels ? data[rowStart + x - channels] : 0;
      const up = y > 0 ? data[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? data[rowStart - stride + x - channels] : 0;
      let val = rawVal;
      if (filter === 1) val = (val + left) & 0xff;
      else if (filter === 2) val = (val + up) & 0xff;
      else if (filter === 3) val = (val + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        val = (val + pr) & 0xff;
      }
      data[rowStart + x] = val;
    }
  }
  return { width, height, channels, data };
}

async function measure() {
  const buf = readFileSync('references/visual/02-silhouette.png');
  const { width, height, channels, data } = decodePNG(buf);
  console.log('Image dimensions:', width, height, channels);
  
  // Find column sums of black pixels between y=200 and y=500
  const colSums = new Int32Array(width);
  for (let y = 200; y < 520; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels] < 50) colSums[x]++;
    }
  }
  // Find where column sums drop to 0 or near 0 to separate the 6 figures:
  // Front, Rear, Left Profile, Right Profile, Front 3/4, Rear 3/4
  const gaps = [];
  let inFigure = false;
  let startX = 0;
  const figures = [];
  for (let x = 0; x < width; x++) {
    if (colSums[x] > 10 && !inFigure) {
      inFigure = true;
      startX = x;
    } else if (colSums[x] <= 10 && inFigure) {
      inFigure = false;
      figures.push({ startX, endX: x, w: x - startX });
    }
  }
  if (inFigure) figures.push({ startX, endX: width, w: width - startX });
  console.log('Detected figures in image:', figures);
  
  function analyzeFigure(name, xMin, xMax) {
    let minY = 10000, maxY = 0, actualMinX = 10000, actualMaxX = 0;
    for (let y = 140; y < 600; y++) {
      for (let x = xMin; x <= xMax; x++) {
        if (data[(y * width + x) * channels] < 50) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x < actualMinX) actualMinX = x;
          if (x > actualMaxX) actualMaxX = x;
        }
      }
    }
    // Trim text under feet if any
    for (let y = maxY; y >= minY; y--) {
      let count = 0;
      for (let x = actualMinX; x <= actualMaxX; x++) {
        if (data[(y * width + x) * channels] < 50) count++;
      }
      if (count > 15) { maxY = y; break; }
    }
    const h = maxY - minY;
    const w = actualMaxX - actualMinX;
    console.log(`\n=== ${name} ===`);
    console.log(`Bounds: Y=[${minY}..${maxY}] (H=${h}), X=[${actualMinX}..${actualMaxX}] (W=${w})`);
    console.log(`Overall Aspect Ratio (Width / Height): ${(w / h).toFixed(3)}`);
    
    // Measure at key anatomical heights (% from head top 0% to soles 100%):
    // 0%: Crown
    // 10%: Eyes / Nose
    // 14%: Chin / Neck
    // 20%: Traps / Shoulders
    // 28%: Mid chest / Pectorals
    // 38%: Belly apex / Umbilicus
    // 48%: Pelvis / Crotch
    // 58%: Mid thigh
    // 72%: Knee
    // 85%: Calf apex
    // 95%: Ankle
    // 100%: Sole
    const samplePercents = [0, 5, 8, 10, 12, 14, 17, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
    for (const p of samplePercents) {
      const y = Math.round(minY + h * (p / 100));
      let x0 = 10000, x1 = 0;
      for (let x = actualMinX; x <= actualMaxX; x++) {
        if (data[(y * width + x) * channels] < 50) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
      const sliceW = x1 >= x0 ? x1 - x0 : 0;
      console.log(`p=${String(p).padStart(3)}% (y=${y}): width=${String(sliceW).padStart(3)}, ratioToH=${(sliceW / h).toFixed(3)}, x=[${x0}..${x1}]`);
    }
  }

  analyzeFigure('FRONT', 8, 197);
  analyzeFigure('LEFT PROFILE', 386, 498);
}

measure().catch(console.error);
