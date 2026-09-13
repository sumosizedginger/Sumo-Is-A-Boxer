/**
 * SUMO IS A BOXER — Material language.
 *
 * Every surface in this game is described by a Material Forge MaterialDefinition
 * (`createMaterialDefinition` from @sumosizedginger/my-game-engine-1.0/full).
 * Nothing here compiles a Three.js material: compilation is an engine-owned
 * boundary, and the game only ever hands definitions to `createPreviewable`.
 *
 * THE FAILURE MODE THIS FILE EXISTS TO AVOID is the procedural-demo look where
 * one material is tinted twelve ways. Each family below has its own physical
 * identity — concrete is rough and dead, ring rope is bright and dry, glove
 * leather is smooth with a faint sheen, structural steel is dark and metallic,
 * painted metal sits between them — and each family then carries several SEEDED
 * VARIANTS so that neighbouring panels, columns and boards are not the same
 * colour.
 *
 * Material Forge exposes colour, roughness, metalness, emissive and
 * emissiveIntensity. It has no texture, map, noise or vertex-colour pathway
 * (ENGINE_GAPS.md — GAP-06), so surface breakup in this build is produced by
 * variant families plus authored geometry, not by texturing.
 */

import { createMaterialDefinition } from '@sumosizedginger/my-game-engine-1.0/full';
import { createSeededRandom } from './kit.js';

export const MATERIAL_SEED = 90210;

const rng = createSeededRandom(MATERIAL_SEED);

const definitions = [];
const families = new Map();

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function variedMetalness(base,jitter) { const drift=rng.range(-0.05,0.05)*jitter;return base===0?0:clamp01(base+drift); }

/**
 * Shifts a packed RGB colour by per-channel deltas in [-1, 1] of full scale.
 *
 * @param {number} color
 * @param {number} dr
 * @param {number} dg
 * @param {number} db
 * @returns {number}
 */
function shade(color, dr, dg, db) {
  const r = clamp01(((color >> 16) & 0xff) / 255 + dr);
  const g = clamp01(((color >> 8) & 0xff) / 255 + dg);
  const b = clamp01((color & 0xff) / 255 + db);
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

/**
 * Registers a material family: one physical identity, several seeded variants.
 *
 * @param {string} family
 * @param {object} base - { color, roughness, metalness, emissive?, emissiveIntensity? }
 * @param {object} [options]
 * @param {number} [options.variants=3]
 * @param {number} [options.spread=0.045] - Colour jitter amplitude.
 * @param {number} [options.roughnessSpread=0.07]
 * @returns {Array<string>} Variant ids.
 */
function family(familyName, base, { variants = 3, spread = 0.045, roughnessSpread = 0.07, name } = {}) {
  const ids = [];
  for (let i = 0; i < variants; i += 1) {
    const id = `mat.${familyName}.${i}`;
    // Variant 0 is always the exact authored identity, so a family reads as a
    // deliberate colour with drift around it rather than a random cloud.
    const jitter = i === 0 ? 0 : 1;
    const warm = rng.range(-spread, spread) * jitter;
    const definition = createMaterialDefinition({
      id,
      name: `${name ?? familyName} ${i}`,
      color: shade(
        base.color,
        warm + rng.range(-spread, spread) * jitter * 0.5,
        warm * 0.85 + rng.range(-spread, spread) * jitter * 0.5,
        warm * 0.6 + rng.range(-spread, spread) * jitter * 0.5
      ),
      roughness: clamp01(base.roughness + rng.range(-roughnessSpread, roughnessSpread) * jitter),
      metalness: variedMetalness(base.metalness,jitter),
      emissive: base.emissive ?? 0x000000,
      emissiveIntensity: base.emissiveIntensity ?? 0
    });
    definitions.push(definition);
    ids.push(id);
  }
  families.set(familyName, ids);
  return ids;
}

// ---------------------------------------------------------------------------
// THE FAMILIES
// ---------------------------------------------------------------------------

// --- Venue shell -----------------------------------------------------------
family('concrete', { color: 0x4a4641, roughness: 0.96, metalness: 0.0 }, { variants: 5, spread: 0.05, name: 'Aged Concrete' });
family('concreteDark', { color: 0x312e2a, roughness: 0.97, metalness: 0.0 }, { variants: 4, spread: 0.035, name: 'Shadowed Concrete' });
family('concreteStain', { color: 0x1b1916, roughness: 0.99, metalness: 0.0 }, { variants: 3, spread: 0.02, name: 'Damp Concrete Stain' });
family('brick', { color: 0x4a342b, roughness: 0.94, metalness: 0.0 }, { variants: 4, spread: 0.05, name: 'Old Brick Patch' });

// --- Structure -------------------------------------------------------------
family('steel', { color: 0x363a42, roughness: 0.52, metalness: 0.78 }, { variants: 4, spread: 0.03, name: 'Dark Structural Steel' });
family('steelWorn', { color: 0x4b4a47, roughness: 0.40, metalness: 0.88 }, { variants: 3, spread: 0.035, name: 'Worn Bright Steel' });
family('paintRed', { color: 0x5e2b22, roughness: 0.74, metalness: 0.22 }, { variants: 4, spread: 0.05, name: 'Red Oxide Painted Metal' });
family('paintGreen', { color: 0x2f4038, roughness: 0.78, metalness: 0.20 }, { variants: 3, spread: 0.045, name: 'Faded Industrial Green' });
family('paintYellow', { color: 0x8a6a1e, roughness: 0.80, metalness: 0.15 }, { variants: 3, spread: 0.05, name: 'Hazard Yellow, Chipped' });
family('rust', { color: 0x60391f, roughness: 0.95, metalness: 0.30 }, { variants: 4, spread: 0.06, name: 'Rust Bloom' });

// --- Ring ------------------------------------------------------------------
family('canvas', { color: 0x6f6758, roughness: 0.94, metalness: 0.0 }, { variants: 5, spread: 0.035, name: 'Old Fight Canvas' });
family('canvasStain', { color: 0x686051, roughness: 0.96, metalness: 0.0 }, { variants: 4, spread: 0.022, name: 'Sweat-Darkened Canvas' });
family('apron', { color: 0x36343a, roughness: 0.86, metalness: 0.05 }, { variants: 3, spread: 0.03, name: 'Ring Apron Skirt' });
family('rope', { color: 0xd6cfbc, roughness: 0.84, metalness: 0.0 }, { variants: 4, spread: 0.04, name: 'Dirty Off-White Rope' });
family('ropeBinding', { color: 0x23211f, roughness: 0.90, metalness: 0.05 }, { variants: 3, spread: 0.03, name: 'Rope Binding Tape' });
family('cornerRed', { color: 0x7e1d18, roughness: 0.62, metalness: 0.05 }, { variants: 3, spread: 0.04, name: 'Red Corner Padding' });
family('cornerBlue', { color: 0x1c3560, roughness: 0.62, metalness: 0.05 }, { variants: 3, spread: 0.04, name: 'Blue Corner Padding' });
family('cornerNeutral', { color: 0x6d6659, roughness: 0.70, metalness: 0.04 }, { variants: 3, spread: 0.035, name: 'Neutral Corner Padding' });

// --- Fighters --------------------------------------------------------------
family('skin', { color: 0x87684f, roughness: 0.7, metalness: 0.02 }, { variants: 3, spread: 0.03, name: 'Fighter Skin' });
family('skinPlayer', { color: 0xa07f62, roughness: 0.64, metalness: 0.03 }, { variants: 2, spread: 0.02, name: 'Player Skin' });
family('leatherRed', { color: 0x761a16, roughness: 0.38, metalness: 0.1 }, { variants: 3, spread: 0.035, name: 'Red Glove Leather' });
family('leatherBlue', { color: 0x1b3566, roughness: 0.46, metalness: 0.08 }, { variants: 3, spread: 0.035, name: 'Blue Glove Leather' });
family('leatherBlack', { color: 0x17161a, roughness: 0.46, metalness: 0.08 }, { variants: 3, spread: 0.025, name: 'Black Leather' });
// Cropped hair is not leather. Sharing the glove material made the crown read as
// wet black plastic under the ring lamps; hair needs an almost fully diffuse response.
family('hair', { color: 0x14110f, roughness: 0.94, metalness: 0.0 }, { variants: 2, spread: 0.02, name: 'Cropped Hair' });
family('wraps', { color: 0xcdc5b4, roughness: 0.88, metalness: 0.0 }, { variants: 3, spread: 0.035, name: 'Hand Wraps' });
family('cloth', { color: 0x23262f, roughness: 0.72, metalness: 0.04 }, { variants: 3, spread: 0.03, name: 'Trunk Cloth' });
family('clothTrim', { color: 0x9a8c5d, roughness: 0.66, metalness: 0.10 }, { variants: 3, spread: 0.04, name: 'Trunk Trim' });
family('towel', { color: 0xb9b2a3, roughness: 0.95, metalness: 0.0 }, { variants: 3, spread: 0.04, name: 'Corner Towel' });
family('rubber', { color: 0x121316, roughness: 0.95, metalness: 0.02 }, { variants: 3, spread: 0.02, name: 'Rubber' });

// --- Dressing --------------------------------------------------------------
family('timber', { color: 0x4a3a2a, roughness: 0.90, metalness: 0.0 }, { variants: 4, spread: 0.05, name: 'Old Timber' });
family('crowd', { color: 0x0c0d11, roughness: 0.99, metalness: 0.0 }, { variants: 3, spread: 0.012, name: 'Crowd Silhouette' });
family('plastic', { color: 0x2d3a3f, roughness: 0.72, metalness: 0.03 }, { variants: 3, spread: 0.05, name: 'Scuffed Plastic' });

// --- Light fixtures --------------------------------------------------------
family('lampHousing', { color: 0x1e1c1a, roughness: 0.60, metalness: 0.55 }, { variants: 2, spread: 0.02, name: 'Lamp Housing' });
family('lampDish', { color: 0x8a836f, roughness: 0.35, metalness: 0.70 }, { variants: 2, spread: 0.03, name: 'Lamp Reflector' });
family('bulb', { color: 0xffe6bb, roughness: 0.30, metalness: 0.0, emissive: 0xffb757, emissiveIntensity: 4.2 }, { variants: 1, name: 'Hot Bulb' });
family('bulbRed', { color: 0xff8a76, roughness: 0.35, metalness: 0.0, emissive: 0xd1281c, emissiveIntensity: 3.4 }, { variants: 1, name: 'Red Corner Lamp' });
family('bulbBlue', { color: 0x8ab6ff, roughness: 0.35, metalness: 0.0, emissive: 0x2554c4, emissiveIntensity: 3.4 }, { variants: 1, name: 'Blue Corner Lamp' });
family('exitSign', { color: 0x1c2a20, roughness: 0.6, metalness: 0.1, emissive: 0x1f8a3c, emissiveIntensity: 2.2 }, { variants: 1, name: 'Exit Sign' });

/** Every MaterialDefinition this game authors. Handed to the presentation layer. */
export const MATERIAL_DEFINITIONS = Object.freeze([...definitions]);

/** family -> variant ids. */
export const MATERIAL_FAMILIES = Object.freeze(Object.fromEntries([...families.entries()].map(([k, v]) => [k, Object.freeze(v)])));

/**
 * Picks a deterministic variant of a family.
 *
 * The discriminator is hashed, so the same object always gets the same variant
 * across reloads and rematches. That is what makes "controlled variation"
 * controlled rather than a lottery.
 *
 * @param {string} familyName
 * @param {number|string} [discriminator=0]
 * @returns {string} Material id.
 */
export function mat(familyName, discriminator = 0) {
  const ids = families.get(familyName);
  if (!ids) throw new Error(`Unknown material family "${familyName}"`);
  let hash = 0;
  const key = String(discriminator);
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return ids[hash % ids.length];
}

/**
 * The authored identity of a family (variant 0).
 *
 * @param {string} familyName
 * @returns {string}
 */
export function matBase(familyName) {
  return families.get(familyName)[0];
}

/**
 * Looks a definition up by id — used by the presentation layer and by tests
 * that assert an asset only references materials the game actually authored.
 *
 * @param {string} id
 * @returns {object|undefined}
 */
export function materialById(id) {
  return definitions.find((definition) => definition.id === id);
}
