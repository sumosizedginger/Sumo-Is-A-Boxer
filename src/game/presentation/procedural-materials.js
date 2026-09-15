// VQ-003: a bounded game-owned surface experiment, not an engine texture API.
// Packed linear-data channels: R height, G roughness modulation, B albedo gain.
import {
  DataTexture, RGBAFormat, UnsignedByteType, RepeatWrapping, ClampToEdgeWrapping,
  LinearFilter, LinearMipmapLinearFilter, NoColorSpace
} from 'three';

export const SURFACE_SEED = 310903;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = t => t * t * (3 - 2 * t);
const wrap = (v, n) => (v % n + n) % n;
function hash(x, y, seed) {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(u, v, cells, seed, rows = cells) {
  const x = u * cells, y = v * rows, ix = Math.floor(x), iy = Math.floor(y);
  const tx = smooth(x - ix), ty = smooth(y - iy);
  const at = (a, b) => hash(wrap(a, cells), wrap(b, rows), seed);
  const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
  const b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
  return a * (1 - ty) + b * ty;
}
function grain(u, v, seed) {
  const x = u * 24, y = v * 24, ix = Math.floor(x), iy = Math.floor(y);
  let first = 9, second = 9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = ix + dx, cy = iy + dy;
    const px = cx + .2 + hash(wrap(cx, 24), wrap(cy, 24), seed) * .6;
    const py = cy + .2 + hash(wrap(cx, 24), wrap(cy, 24), seed + 9) * .6;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < first) { second = first; first = d; } else second = Math.min(second, d);
  }
  return smooth(clamp((Math.sqrt(second) - Math.sqrt(first)) * 4));
}

// Exported CPU generation allows byte-level determinism checks without a DOM/GPU.
export function generateSurfaceData(kind, { size = 256, seed = SURFACE_SEED } = {}) {
  if (!['canvas', 'leather', 'skin', 'concrete', 'steel', 'canvasHistory'].includes(kind)) throw new Error(`Unknown surface ${kind}`);
  if (![256, 512].includes(size)) throw new Error('Surface size must be 256 or 512');
  const data = new Uint8Array(size * size * 4);
  const tracks = kind === 'canvasHistory' ? Array.from({length:12}, (_,i) => {
    const t=i/11, angle=hash(i,7,seed)*2.5;
    return {x:-1.8+t*3.5,z:Math.sin(t*5.2)*.65,c:Math.cos(angle),s:Math.sin(angle)};
  }) : [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    const broad = noise(u, v, 4, seed), fine = noise(u, v, 64, seed + 1);
    let height = .5, rough = .5, color = .5;
    if (kind === 'canvas') {
      const warp = noise(u, v, 8, seed + 2) * .14;
      const a = Math.sin((u * 32 + warp) * Math.PI * 2);
      const b = Math.sin((v * 32 + warp) * Math.PI * 2);
      height = .5 + (a + b) * .12 + a * b * .07 + (fine - .5) * .05;
      rough = .58 + (height - .5) * .32; color = .5 + (height - .5) * .1;
    } else if (kind === 'leather') {
      const cell = grain(u, v, seed + 3);
      height = .34 + cell * .25 + (fine - .5) * .07;
      rough = .48 + cell * .2 + (broad - .5) * .12;
    } else if (kind === 'skin') {
      rough = .32 + broad * .36 + noise(u, v, 12, seed + 5) * .12;
    } else if (kind === 'concrete') {
      height = .45 + (fine - .5) * .22 + (broad - .5) * .12;
      rough = .45 + broad * .25 + fine * .10;
      color = .47 + (broad - .5) * .16 + (fine - .5) * .06;
    } else if (kind === 'steel') {
      const abrasion = noise(u, v, 8, seed + 11, 64);
      height = .5 + (abrasion - .5) * .18;
      rough = .5 + (abrasion - .5) * .32 + (broad - .5) * .08;
      color = .5 + (broad - .5) * .08;
    } else {
      // One non-repeating 8.5 m cloth sheet. History follows corner work and
      // two crossing footwork lanes; never a random per-pixel stain lottery.
      const px = (u - .5) * 8.5, pz = (v - .5) * 8.5;
      let wear = 0;
      for (const sign of [-1, 1]) {
        wear += Math.exp(-((px - sign * 2.8) ** 2 / .38 + (pz - sign * 2.8) ** 2 / .5)) * .24;
      }
      for (const track of tracks) {
        const dx=px-track.x,dz=pz-track.z;
        const along=dx*track.c+dz*track.s;
        const across=-dx*track.s+dz*track.c;
        wear += Math.exp(-(along * along / .09 + across * across / .0008)) * .11;
      }
      wear = clamp(wear);
      rough = .52 - wear * .25;
      color = .49 - wear * .27 + (broad - .5) * .055;
    }
    const i = (y * size + x) * 4;
    data[i] = Math.round(clamp(height) * 255);
    data[i + 1] = Math.round(clamp(rough) * 255);
    data[i + 2] = Math.round(clamp(color) * 255);
    data[i + 3] = 255;
  }
  return data;
}

const SETTINGS = {
  canvas: { scale: 8, bump: .00010, rough: .10, color: .08 },
  leather: { scale: 13, bump: .000045, rough: .11, color: 0 },
  skin: { scale: 3, bump: 0, rough: .08, color: 0 },
  concrete: { scale: 1.7, bump: .00020, rough: .18, color: .14 },
  steel: { scale: 3, bump: .000025, rough: .12, color: .07 }
};
const declarations = `
varying vec3 vTactilePosition;
varying vec3 vTactileNormal;
uniform sampler2D tactileMicro;
uniform sampler2D tactileHistory;
uniform float tactileEnabled;
uniform float tactileScale;
uniform float tactileBump;
uniform float tactileRough;
uniform float tactileColor;
vec3 tactileSample() {
  vec3 w = pow(abs(normalize(vTactileNormal)), vec3(6.0));
  w /= max(dot(w, vec3(1.0)), 0.00001);
  vec3 p = vTactilePosition * tactileScale;
  return texture2D(tactileMicro, p.yz).rgb * w.x
       + texture2D(tactileMicro, p.xz).rgb * w.y
       + texture2D(tactileMicro, p.xy).rgb * w.z;
}
`;

export function createProceduralMaterials({ seed = SURFACE_SEED, anisotropy = 4, enabled = true, onGeneration = () => {} } = {}) {
  const textures = new Map(), bindings = new Map();
  const enabledUniform = { value: enabled ? 1 : 0 };
  let generationMs = 0, disposed = false;
  function texture(kind) {
    if (disposed) throw new Error('Procedural material owner is disposed');
    if (textures.has(kind)) return textures.get(kind);
    const size = kind === 'canvasHistory' ? 512 : 256, start = performance.now();
    const data = generateSurfaceData(kind, { size, seed });
    const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    t.name = `vq003.${kind}.${seed}`; t.colorSpace = NoColorSpace;
    t.wrapS = t.wrapT = kind === 'canvasHistory' ? ClampToEdgeWrapping : RepeatWrapping;
    t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = Math.max(1, Math.min(8, anisotropy));
    t.needsUpdate = true; textures.set(kind, t);
    const end = performance.now();
    generationMs += end - start;
    onGeneration({ kind, start, end });
    return t;
  }
  function apply(material, assetKey = '', id = material.name) {
    if (disposed) throw new Error('Procedural material owner is disposed');
    if (bindings.has(material)) return;
    let kind = null;
    if (id.startsWith('mat.canvas')) kind = 'canvas';
    else if (/mat\.leather(Red|Blue)\./.test(id) && /glove|fp\.arm/.test(assetKey)) kind = 'leather';
    else if (id.startsWith('mat.concrete') && /warehouse\.(floor|walls|column)/.test(assetKey)) kind = 'concrete';
    else if (/mat\.steel(Worn)?\./.test(id) && /warehouse\.(gantry|services)|arena\.platform/.test(assetKey)) kind = 'steel';
    else if (id.startsWith('mat.skin.') && assetKey === 'opponent-skin') kind = 'skin';
    if (!kind) return;
    const config = SETTINGS[kind], micro = texture(kind);
    const history = kind === 'canvas' ? texture('canvasHistory') : micro;
    const originalCompile = material.onBeforeCompile, originalKey = material.customProgramCacheKey;
    const baseKey = originalKey.call(material);
    material.onBeforeCompile = function(shader, renderer) {
      originalCompile.call(this, shader, renderer);
      Object.assign(shader.uniforms, {
        tactileMicro: { value: micro }, tactileHistory: { value: history }, tactileEnabled: enabledUniform,
        tactileScale: { value: config.scale }, tactileBump: { value: config.bump },
        tactileRough: { value: config.rough }, tactileColor: { value: config.color }
      });
      shader.vertexShader = 'varying vec3 vTactilePosition;\nvarying vec3 vTactileNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTactilePosition = position; vTactileNormal = normal;');
      shader.fragmentShader = declarations + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        vec3 tactile = vec3(0.5);
        if (tactileEnabled > 0.5) {
          tactile = tactileSample();
          float region = ${kind === 'skin' ? 'smoothstep(1.23,1.38,vTactilePosition.y) * (1.0-smoothstep(1.80,1.86,vTactilePosition.y))' : '1.0'};
          roughnessFactor = clamp(roughnessFactor + (tactile.g - 0.5) * tactileRough * region, 0.25, 1.0);
          diffuseColor.rgb *= 1.0 + (tactile.b - 0.5) * tactileColor;
          ${kind === 'canvas' ? `vec3 history = texture2D(tactileHistory, vTactilePosition.xz / 8.5 + 0.5).rgb;
            diffuseColor.rgb *= 1.0 + (history.b - 0.5) * 0.4;
            roughnessFactor = clamp(roughnessFactor + (history.g - 0.5) * 0.12, 0.84, 1.0);` : ''}
        }
      `);
      if (config.bump > 0) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        if (tactileEnabled > 0.5) {
          vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
          vec3 r1 = cross(dy, normal), r2 = cross(normal, dx);
          float det = dot(dx, r1);
          vec3 gradient = sign(det) * (dFdx(tactile.r) * r1 + dFdy(tactile.r) * r2) * tactileBump;
          vec3 perturbed = normalize(max(abs(det), 1e-10) * normal - gradient);
          normal = normalize(mix(normal, perturbed, 0.45));
        }
      `);
    };
    material.customProgramCacheKey = () => `${baseKey}|vq003-surface-v1|${kind}`;
    material.needsUpdate = true;
    bindings.set(material, { originalCompile, originalKey, kind });
  }
  return {
    apply,
    setEnabled(on) { enabledUniform.value = on ? 1 : 0; },
    stats() {
      const inventory = [...textures].map(([kind, t]) => ({ kind, width: t.image.width, height: t.image.height, bytes: t.image.data.byteLength, mipBytesEstimate: Math.ceil(t.image.data.byteLength * 4 / 3) }));
      return { enabled: enabledUniform.value === 1, seed, generationMs, textures: inventory.length, bindings: bindings.size, inventory, gpuBytesEstimate: inventory.reduce((n,t)=>n+t.mipBytesEstimate,0), disposed };
    },
    dispose() {
      if (disposed) return;
      for (const [m, previous] of bindings) { m.onBeforeCompile = previous.originalCompile; m.customProgramCacheKey = previous.originalKey; m.needsUpdate = true; }
      bindings.clear(); for (const t of textures.values()) t.dispose(); textures.clear(); disposed = true;
    }
  };
}
