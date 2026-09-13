/**
 * SUMO IS A BOXER — Environmental dressing.
 *
 * Training equipment, seating, barriers and the crowd. This is the layer that
 * decides whether the venue reads as a PLACE PEOPLE USE or as an empty box with
 * a ring in it.
 *
 * Every repeated object is authored once and placed many times by the scene.
 */

import {
  place, slab, rod, strut, revolve, roundedBox, repeat, assemble, chain,
  createSeededRandom
} from './kit.js';
import { mat } from './materials.js';
import { createAnchor } from '@sumosizedginger/my-game-engine-1.0/full';

/**
 * The heavy bag, its chain, swivel and the beam bracket it hangs from.
 * Authored at the origin with y = 0 at the bag's hang point.
 *
 * @returns {object} MeshIR
 */
function buildHeavyBag() {
  const bag = revolve({
    profile: [
      [0, 0], [0.16, -0.03], [0.2, -0.1], [0.215, -0.34],
      [0.218, -0.8], [0.21, -1.12], [0.185, -1.25], [0.12, -1.31], [0, -1.32]
    ],
    semanticName: 'heavy-bag-body',
    segments: 18
  });
  // Stitched seam bands and the reinforced top collar.
  const bands = [
    revolve({ profile: [[0.222, -0.36], [0.226, -0.38], [0.222, -0.4]], semanticName: 'heavy-bag-seam-upper', segments: 18 }),
    revolve({ profile: [[0.224, -0.74], [0.228, -0.76], [0.224, -0.78]], semanticName: 'heavy-bag-seam-lower', segments: 18 }),
    revolve({ profile: [[0.17, -0.02], [0.205, -0.06], [0.205, -0.12], [0.19, -0.14]], semanticName: 'heavy-bag-collar', segments: 18 })
  ];
  const hardware = [
    ...repeat(4, (i) => {
      const a = (i / 4) * Math.PI * 2;
      return strut([Math.cos(a) * 0.16, -0.06, Math.sin(a) * 0.16], [0, 0.26, 0], { radius: 0.011, segments: 5, name: `heavy-bag-strap-${i}` });
    }),
    revolve({ profile: [[0.02, 0.26], [0.05, 0.3], [0.05, 0.4], [0.02, 0.44]], semanticName: 'heavy-bag-swivel', segments: 10 })
  ];
  const bagChain = chain({ from: [0, 0.44, 0], to: [0, 1.9, 0], links: 14, linkRadius: 0.04, thickness: 0.01, name: 'heavy-bag-chain' });
  const bracket = [
    slab([0.5, 0.1, 0.24], [0, 1.98, 0], { name: 'heavy-bag-bracket-plate' }),
    strut([-0.2, 1.98, 0], [-0.2, 2.4, -0.5], { radius: 0.03, name: 'heavy-bag-bracket-stay-a' }),
    strut([0.2, 1.98, 0], [0.2, 2.4, -0.5], { radius: 0.03, name: 'heavy-bag-bracket-stay-b' })
  ];

  return assemble('asset.heavy.bag', [
    { name: 'heavy-bag-leather', material: mat('leatherBlack', 0), meshes: [bag] },
    { name: 'heavy-bag-seams', material: mat('leatherBlack', 2), meshes: bands },
    { name: 'heavy-bag-hardware', material: mat('steelWorn', 0), meshes: hardware },
    { name: 'heavy-bag-chain', material: mat('steel', 2), meshes: [...bagChain, ...bracket] }
  ], {
    anchors: [createAnchor({ name: 'heavybag.hang', position: [0, 0, 0] })]
  });
}

/**
 * A crowd-control barrier panel: two feet, two rails, vertical bars.
 *
 * @returns {object} MeshIR
 */
function buildBarrier() {
  const width = 2.2;
  const height = 1.05;
  const frame = [
    rod({ radius: 0.028, length: width, at: [0, height, 0], dir: [1, 0, 0], segments: 7, name: 'barrier-rail-top' }),
    rod({ radius: 0.024, length: width, at: [0, height * 0.42, 0], dir: [1, 0, 0], segments: 7, name: 'barrier-rail-mid' }),
    rod({ radius: 0.03, length: height, at: [-width / 2, height / 2, 0], segments: 7, name: 'barrier-stile-west' }),
    rod({ radius: 0.03, length: height, at: [width / 2, height / 2, 0], segments: 7, name: 'barrier-stile-east' })
  ];
  const bars = repeat(9, (i, t) => rod({
    radius: 0.014,
    length: height - 0.04,
    at: [(t - 0.5) * (width - 0.2), height / 2, 0],
    segments: 5,
    name: `barrier-bar-${i}`
  }));
  const feet = [
    rod({ radius: 0.022, length: 0.7, at: [-width / 2, 0.02, 0], dir: [0, 0, 1], segments: 6, name: 'barrier-foot-west' }),
    rod({ radius: 0.022, length: 0.7, at: [width / 2, 0.02, 0], dir: [0, 0, 1], segments: 6, name: 'barrier-foot-east' })
  ];
  return assemble('asset.barrier', [
    { name: 'ringside-barrier-frame', material: mat('steelWorn', 2), meshes: [...frame, ...feet] },
    { name: 'ringside-barrier-bars', material: mat('steel', 0), meshes: bars }
  ]);
}

/**
 * A bleacher stand: stepped timber planks on a welded steel frame.
 *
 * @returns {object} MeshIR
 */
function buildBleacher() {
  const rows = 4;
  const width = 7.2;
  const planks = [];
  const frame = [];
  const backs = [];

  for (let r = 0; r < rows; r += 1) {
    const y = 0.42 + r * 0.42;
    const z = -r * 0.62;
    planks.push(slab([width, 0.07, 0.4], [0, y, z], { name: `bleacher-seat-${r}` }));
    planks.push(slab([width, 0.07, 0.34], [0, y - 0.2, z + 0.28], { name: `bleacher-riser-${r}` }));
    for (let s = 0; s < 5; s += 1) {
      const x = -width / 2 + 0.5 + (s / 4) * (width - 1);
      frame.push(slab([0.09, y, 0.09], [x, y / 2, z], { name: `bleacher-post-${r}-${s}` }));
      if (r > 0) {
        frame.push(strut([x, y, z], [x, y - 0.42, z + 0.62], { radius: 0.03, segments: 5, name: `bleacher-brace-${r}-${s}` }));
      }
    }
  }
  backs.push(slab([width, 0.9, 0.08], [0, 1.9, -rows * 0.62 + 0.1], { name: 'bleacher-back-rail' }));
  for (let s = 0; s < 5; s += 1) {
    const x = -width / 2 + 0.5 + (s / 4) * (width - 1);
    backs.push(slab([0.07, 1.0, 0.07], [x, 1.62, -rows * 0.62 + 0.1], { name: `bleacher-back-post-${s}` }));
  }

  return assemble('asset.bleacher', [
    { name: 'bleacher-planks', material: mat('timber', 0), meshes: planks },
    { name: 'bleacher-frame', material: mat('steel', 1), meshes: frame },
    { name: 'bleacher-back', material: mat('paintRed', 3), meshes: backs }
  ]);
}

/**
 * A row of crowd silhouettes.
 *
 * Characters in the dark: the point is SHOULDER LINE and HEAD, the two shapes a
 * human eye resolves at distance with no light on them. They are fused into a
 * single part because nothing addresses an individual spectator, and they use a
 * near-black matte material so they swallow light and stay silhouettes.
 *
 * @param {object} [options]
 * @returns {object} MeshIR
 */
function buildCrowdRow({ id = 'asset.crowd.row', count = 13, spacing = 0.66, seed = 2024, seated = false } = {}) {
  const rng = createSeededRandom(seed);
  const bodies = [];

  for (let i = 0; i < count; i += 1) {
    const x = (i - (count - 1) / 2) * spacing + rng.range(-0.09, 0.09);
    const z = rng.range(-0.22, 0.22);
    const scale = rng.range(0.92, 1.09);
    const lean = rng.range(-0.1, 0.1);
    const turn = rng.range(-0.45, 0.45);

    const torso = revolve({
      profile: seated
        ? [[0.19, 0], [0.22, 0.18], [0.24, 0.42], [0.26, 0.62], [0.22, 0.78], [0.14, 0.86], [0.1, 0.9]]
        : [[0.16, 0], [0.19, 0.3], [0.21, 0.62], [0.25, 0.95], [0.26, 1.16], [0.2, 1.32], [0.13, 1.4]],
      semanticName: `crowd-torso-${i}`,
      segments: 9,
      squashZ: 0.62
    });
    const head = revolve({
      profile: [[0, 0], [0.06, 0.02], [0.095, 0.08], [0.1, 0.15], [0.085, 0.21], [0.05, 0.24], [0, 0.25]],
      semanticName: `crowd-head-${i}`,
      segments: 9,
      squashZ: 0.85
    });
    const shoulders = revolve({
      profile: [[0.05, 0], [0.16, 0.03], [0.19, 0.08], [0.15, 0.13], [0.05, 0.15]],
      semanticName: `crowd-shoulder-${i}`,
      segments: 8,
      squashZ: 0.55
    });

    const scaleTriple = [scale, scale, scale];
    const bodyY = seated ? 0.52 : 0;
    bodies.push(place(torso, { at: [x, bodyY, z], rotate: [lean, turn, 0], scale: scaleTriple }));
    bodies.push(place(shoulders, { at: [x, bodyY + (seated ? 0.84 : 1.34) * scale, z], rotate: [lean, turn, 0], scale: [scale * 1.5, scale, scale] }));
    bodies.push(place(head, { at: [x, bodyY + (seated ? 0.92 : 1.45) * scale, z + 0.02], rotate: [lean * 1.4, turn * 1.3, 0], scale: scaleTriple }));
    // A few raised arms, because a crowd at an illegal fight is not standing still.
    if (rng.next() > 0.72) {
      bodies.push(strut(
        [x + 0.2 * scale, bodyY + 1.2 * scale, z],
        [x + 0.3 * scale + rng.range(-0.1, 0.1), bodyY + (1.75 + rng.range(0, 0.2)) * scale, z + rng.range(-0.1, 0.1)],
        { radius: 0.05, segments: 5, name: `crowd-arm-${i}` }
      ));
    }
  }

  return assemble(id, [
    { name: 'crowd-silhouettes', material: mat('crowd', seed), meshes: bodies }
  ]);
}

/**
 * Ringside training and match clutter: crates, a coiled rope, a mop bucket,
 * a gym bag, folding chairs and water bottles.
 *
 * @returns {object} MeshIR
 */
function buildClutter() {
  const rng = createSeededRandom(6620);
  const crates = [];
  const fabric = [];
  const metal = [];
  const plastic = [];

  // Stacked timber crates.
  const stack = [
    { at: [0, 0.3, 0], size: [0.78, 0.6, 0.6], rotate: [0, 0.12, 0] },
    { at: [0.05, 0.88, -0.06], size: [0.7, 0.55, 0.55], rotate: [0, -0.3, 0.02] },
    { at: [0.95, 0.26, 0.3], size: [0.6, 0.52, 0.52], rotate: [0, 0.55, 0] }
  ];
  for (let i = 0; i < stack.length; i += 1) {
    const crate = stack[i];
    crates.push(place(roundedBox({ size: crate.size, radius: 0.02, semanticName: `clutter-crate-${i}` }), { at: crate.at, rotate: crate.rotate }));
    // Slat detail on the visible faces.
    for (let s = 0; s < 3; s += 1) {
      crates.push(place(
        roundedBox({ size: [crate.size[0] + 0.02, 0.06, 0.02], radius: 0.008, semanticName: `clutter-crate-slat-${i}-${s}` }),
        { at: [crate.at[0], crate.at[1] - crate.size[1] / 2 + 0.12 + s * 0.18, crate.at[2] + crate.size[2] / 2], rotate: crate.rotate }
      ));
    }
  }

  // Coiled skipping rope.
  const coil = [];
  for (let i = 0; i < 3; i += 1) {
    coil.push(revolve({
      profile: [[0.2 + i * 0.03, 0], [0.215 + i * 0.03, 0.012], [0.2 + i * 0.03, 0.024]],
      semanticName: `clutter-rope-coil-${i}`,
      segments: 14
    }));
  }
  fabric.push(...coil.map((c, i) => place(c, { at: [-1.1, 0.02 + i * 0.022, 0.5] })));
  // Gym bag.
  fabric.push(place(
    revolve({ profile: [[0, -0.18], [0.14, -0.18], [0.19, -0.08], [0.2, 0.04], [0.15, 0.14], [0, 0.16]], semanticName: 'clutter-gym-bag', segments: 12, squashZ: 0.55 }),
    { at: [-0.85, 0.2, -0.5], rotate: [0, 0.5, Math.PI / 2] }
  ));

  // Mop bucket with a wringer.
  plastic.push(place(revolve({
    profile: [[0, 0], [0.2, 0], [0.22, 0.03], [0.25, 0.34], [0.255, 0.36], [0.235, 0.36], [0.23, 0.04], [0, 0.02]],
    semanticName: 'clutter-mop-bucket',
    segments: 12
  }), { at: [1.75, 0, -0.35] }));
  metal.push(strut([1.75, 0.36, -0.35], [1.62, 1.5, -0.62], { radius: 0.018, segments: 5, name: 'clutter-mop-handle' }));

  // Folding chairs.
  for (let i = 0; i < 2; i += 1) {
    const x = -1.9 - i * 0.75;
    const turn = rng.range(-0.6, 0.6);
    metal.push(place(slab([0.42, 0.04, 0.4], [0, 0.46, 0], { name: `clutter-chair-seat-${i}` }), { at: [x, 0, -1.1], rotate: [0, turn, 0] }));
    metal.push(place(slab([0.42, 0.46, 0.04], [0, 0.7, -0.18], { name: `clutter-chair-back-${i}` }), { at: [x, 0, -1.1], rotate: [0.12, turn, 0] }));
    for (let l = 0; l < 4; l += 1) {
      const lx = (l % 2 === 0 ? -1 : 1) * 0.17;
      const lz = (l < 2 ? -1 : 1) * 0.16;
      metal.push(place(rod({ radius: 0.014, length: 0.46, at: [lx, 0.23, lz], segments: 5, name: `clutter-chair-leg-${i}-${l}` }), { at: [x, 0, -1.1], rotate: [0, turn, 0] }));
    }
  }

  // Water bottles in a tray.
  plastic.push(place(slab([0.42, 0.06, 0.3], [0, 0.03, 0], { name: 'clutter-bottle-tray' }), { at: [1.2, 0, 0.9] }));
  for (let i = 0; i < 6; i += 1) {
    const bx = 1.2 + ((i % 3) - 1) * 0.13;
    const bz = 0.9 + (i < 3 ? -0.07 : 0.07);
    plastic.push(place(revolve({
      profile: [[0, 0], [0.035, 0.005], [0.038, 0.14], [0.02, 0.17], [0.018, 0.22], [0, 0.225]],
      semanticName: `clutter-bottle-${i}`,
      segments: 8
    }), { at: [bx, 0.06, bz], rotate: [rng.range(-0.05, 0.05), 0, rng.range(-0.05, 0.05)] }));
  }

  return assemble('asset.clutter', [
    { name: 'ringside-crates', material: mat('timber', 3), meshes: crates },
    { name: 'ringside-fabric', material: mat('towel', 2), meshes: fabric },
    { name: 'ringside-metalwork', material: mat('steel', 3), meshes: metal },
    { name: 'ringside-plastic', material: mat('plastic', 1), meshes: plastic }
  ]);
}

/**
 * A wall-mounted equipment rack with gloves, wraps and a speed-bag platform —
 * the training corner of the room.
 *
 * @returns {object} MeshIR
 */
function buildTrainingRig() {
  const platform = revolve({
    profile: [[0, 0], [0.62, 0], [0.64, -0.03], [0.64, -0.09], [0.6, -0.1], [0, -0.1]],
    semanticName: 'speed-bag-platform',
    segments: 16
  });
  const speedBag = revolve({
    profile: [[0, 0], [0.08, -0.03], [0.11, -0.11], [0.1, -0.22], [0.06, -0.28], [0, -0.3]],
    semanticName: 'speed-bag',
    segments: 12
  });
  const frame = [
    strut([-0.55, 0, -0.2], [-0.55, 0.5, -0.62], { radius: 0.032, name: 'speed-bag-stay-a' }),
    strut([0.55, 0, -0.2], [0.55, 0.5, -0.62], { radius: 0.032, name: 'speed-bag-stay-b' }),
    slab([1.5, 0.12, 0.14], [0, 0.5, -0.66], { name: 'speed-bag-wall-plate' })
  ];
  const rack = [
    slab([2.4, 0.1, 0.16], [0, -0.95, -0.6], { name: 'equipment-rack-shelf' }),
    ...repeat(5, (i, t) => rod({
      radius: 0.016, length: 0.22, at: [(t - 0.5) * 2.0, -1.0, -0.52], dir: [0, 0, 1], segments: 5, name: `equipment-rack-peg-${i}`
    }))
  ];
  const gloves = repeat(3, (i, t) => place(
    revolve({
      profile: [[0, 0], [0.05, -0.02], [0.075, -0.08], [0.08, -0.16], [0.06, -0.22], [0.03, -0.24], [0, -0.245]],
      semanticName: `rack-glove-${i}`,
      segments: 10,
      squashZ: 0.75
    }),
    { at: [(t - 0.5) * 1.6, -1.0, -0.42], rotate: [0.2, 0, i % 2 === 0 ? 0.16 : -0.16] }
  ));

  return assemble('asset.training.rig', [
    { name: 'speed-bag-platform', material: mat('timber', 1), meshes: [platform] },
    { name: 'speed-bag', material: mat('leatherBlack', 1), meshes: [speedBag] },
    { name: 'training-rig-frame', material: mat('steel', 0), meshes: [...frame, ...rack] },
    { name: 'training-rig-gloves', material: mat('leatherRed', 1), meshes: gloves }
  ]);
}

/**
 * Builds every dressing asset.
 *
 * @returns {Map<string, object>}
 */
export function buildDressingAssets() {
  const assets = new Map();
  assets.set('asset.heavy.bag', buildHeavyBag());
  assets.set('asset.barrier', buildBarrier());
  assets.set('asset.bleacher', buildBleacher());
  assets.set('asset.clutter', buildClutter());
  assets.set('asset.training.rig', buildTrainingRig());
  assets.set('asset.crowd.row.standing', buildCrowdRow({ id: 'asset.crowd.row.standing', count: 15, spacing: 0.7, seed: 2024, seated: false }));
  assets.set('asset.crowd.row.standing.b', buildCrowdRow({ id: 'asset.crowd.row.standing.b', count: 13, spacing: 0.76, seed: 3111, seated: false }));
  assets.set('asset.crowd.row.seated', buildCrowdRow({ id: 'asset.crowd.row.seated', count: 11, spacing: 0.78, seed: 4562, seated: true }));
  return assets;
}
