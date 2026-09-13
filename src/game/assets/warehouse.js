/**
 * SUMO IS A BOXER — The warehouse.
 *
 * An illegal bout in an old concrete shed after midnight. The venue is authored
 * so that almost all of it lives in darkness: what the lamps reach must be
 * worth reaching, and what they do not reach must still read as structure when
 * a corner light catches it.
 *
 * Built from Geometry Forge verbs (createBoxMesh, createCylinderMesh,
 * extrudeProfile) and the kit generators. Repeated objects — columns, lamps,
 * bleachers, crowd rows — are authored ONCE and placed many times by the scene,
 * so the venue is dense without uploading the same column eight times.
 */

import {
  place, slab, rod, strut, tube, revolve, roundedBox, repeat, assemble,
  createBoxMesh, extrudeProfile, createSeededRandom, chain
} from './kit.js';
import { mat } from './materials.js';
import { RING } from './ring.js';
import { createAnchor } from '@sumosizedginger/my-game-engine-1.0/full';

export const VENUE = Object.freeze({
  halfX: 15,
  halfZ: 13,
  floorY: RING.floorY,
  wallTop: RING.floorY + 8.4,
  trussY: RING.floorY + 6.9,
  gantryY: RING.floorY + 5.3,
  columnCount: 4
});

/**
 * The concrete slab: poured bays, expansion joints, oil and water staining,
 * and faded floor paint near the loading door.
 *
 * @returns {object} MeshIR
 */
function buildFloor() {
  const rng = createSeededRandom(3301);
  const bays = [];
  const stains = [];
  const joints = [];
  const paint = [];

  const cols = 10;
  const rows = 9;
  const bw = (VENUE.halfX * 2) / cols;
  const bd = (VENUE.halfZ * 2) / rows;

  for (let ix = 0; ix < cols; ix += 1) {
    for (let iz = 0; iz < rows; iz += 1) {
      const x = -VENUE.halfX + bw * (ix + 0.5);
      const z = -VENUE.halfZ + bd * (iz + 0.5);
      const tile = slab([bw - 0.05, 0.3, bd - 0.05], [x, VENUE.floorY - 0.15, z], { name: `warehouse-floor-bay-${ix}-${iz}` });
      // Damp patches gather at the walls and where the roof leaks.
      const edge = Math.max(Math.abs(x) / VENUE.halfX, Math.abs(z) / VENUE.halfZ);
      if (rng.next() + edge * 0.5 > 1.06) stains.push(tile); else bays.push(tile);
    }
  }

  // Expansion joints, slightly recessed.
  for (let ix = 1; ix < cols; ix += 1) {
    joints.push(slab([0.06, 0.06, VENUE.halfZ * 2], [-VENUE.halfX + bw * ix, VENUE.floorY - 0.02, 0], { name: `warehouse-floor-joint-x-${ix}` }));
  }
  for (let iz = 1; iz < rows; iz += 1) {
    joints.push(slab([VENUE.halfX * 2, 0.06, 0.06], [0, VENUE.floorY - 0.02, -VENUE.halfZ + bd * iz], { name: `warehouse-floor-joint-z-${iz}` }));
  }

  // Faded hazard lane by the roller door, and a worn ring-side keep-out band.
  paint.push(slab([0.14, 0.03, 9], [-4.4, VENUE.floorY + 0.005, -VENUE.halfZ + 5.2], { name: 'warehouse-floor-lane-a' }));
  paint.push(slab([0.14, 0.03, 9], [4.4, VENUE.floorY + 0.005, -VENUE.halfZ + 5.2], { name: 'warehouse-floor-lane-b' }));
  paint.push(...repeat(14, (i, t) => slab(
    [0.5, 0.03, 0.1],
    [-4.2 + t * 8.4, VENUE.floorY + 0.005, -VENUE.halfZ + 0.9],
    { name: `warehouse-floor-hazard-${i}` }
  )));

  return assemble('asset.warehouse.floor', [
    { name: 'warehouse-floor-slab', material: mat('concrete', 0), meshes: bays },
    { name: 'warehouse-floor-staining', material: mat('concreteStain', 1), meshes: stains },
    { name: 'warehouse-floor-joints', material: mat('concreteDark', 2), meshes: joints },
    { name: 'warehouse-floor-markings', material: mat('paintYellow', 0), meshes: paint }
  ]);
}

/**
 * Perimeter walls: plinth, painted dado band, pilaster ribs, boarded windows,
 * a brick repair patch and the roof edge.
 *
 * @returns {object} MeshIR
 */
function buildWalls() {
  const rng = createSeededRandom(8123);
  const concrete = [];
  const dado = [];
  const ribs = [];
  const windows = [];
  const brick = [];
  const height = VENUE.wallTop - VENUE.floorY;

  const walls = [
    { name: 'north', at: [0, 0, -VENUE.halfZ], size: [VENUE.halfX * 2, height, 0.5], axis: 'x', span: VENUE.halfX },
    { name: 'south', at: [0, 0, VENUE.halfZ], size: [VENUE.halfX * 2, height, 0.5], axis: 'x', span: VENUE.halfX },
    { name: 'east', at: [VENUE.halfX, 0, 0], size: [0.5, height, VENUE.halfZ * 2], axis: 'z', span: VENUE.halfZ },
    { name: 'west', at: [-VENUE.halfX, 0, 0], size: [0.5, height, VENUE.halfZ * 2], axis: 'z', span: VENUE.halfZ }
  ];

  for (const wall of walls) {
    const cy = VENUE.floorY + height / 2;
    const inward = wall.axis === 'x' ? [0, 0, -Math.sign(wall.at[2])] : [-Math.sign(wall.at[0]), 0, 0];

    concrete.push(slab(wall.size, [wall.at[0], cy, wall.at[2]], { name: `warehouse-wall-${wall.name}` }));

    // The painted dado — waist-high industrial paint, the strongest single cue
    // that this is a working building rather than a grey box.
    const dadoH = 1.6;
    const dadoSize = wall.axis === 'x' ? [VENUE.halfX * 2 - 0.1, dadoH, 0.08] : [0.08, dadoH, VENUE.halfZ * 2 - 0.1];
    dado.push(slab(dadoSize, [
      wall.at[0] + inward[0] * 0.29,
      VENUE.floorY + dadoH / 2,
      wall.at[2] + inward[2] * 0.29
    ], { name: `warehouse-wall-dado-${wall.name}` }));

    // Pilaster ribs every ~3 m.
    const ribCount = Math.round((wall.span * 2) / 3);
    for (let i = 0; i <= ribCount; i += 1) {
      const t = ribCount === 0 ? 0.5 : i / ribCount;
      const offset = -wall.span + t * wall.span * 2;
      const ribSize = wall.axis === 'x' ? [0.42, height, 0.22] : [0.22, height, 0.42];
      ribs.push(slab(ribSize, [
        wall.axis === 'x' ? offset : wall.at[0] + inward[0] * 0.34,
        cy,
        wall.axis === 'x' ? wall.at[2] + inward[2] * 0.34 : offset
      ], { name: `warehouse-pilaster-${wall.name}-${i}` }));
    }

    // High boarded-up windows: a recessed dark panel with steel bars.
    const windowCount = Math.max(2, Math.round(wall.span / 3));
    for (let i = 0; i < windowCount; i += 1) {
      const t = (i + 0.5) / windowCount;
      const offset = -wall.span + t * wall.span * 2;
      const y = VENUE.floorY + height * 0.72;
      const wx = wall.axis === 'x' ? offset : wall.at[0] + inward[0] * 0.26;
      const wz = wall.axis === 'x' ? wall.at[2] + inward[2] * 0.26 : offset;
      const panelSize = wall.axis === 'x' ? [1.7, 1.25, 0.08] : [0.08, 1.25, 1.7];
      windows.push(slab(panelSize, [wx, y, wz], { name: `warehouse-window-${wall.name}-${i}` }));
      for (let b = 0; b < 4; b += 1) {
        const bt = (b + 0.5) / 4 - 0.5;
        const barSize = wall.axis === 'x' ? [0.05, 1.32, 0.1] : [0.1, 1.32, 0.05];
        windows.push(slab(barSize, [
          wall.axis === 'x' ? wx + bt * 1.7 : wx + inward[0] * 0.05,
          y,
          wall.axis === 'x' ? wz + inward[2] * 0.05 : wz + bt * 1.7
        ], { name: `warehouse-window-bar-${wall.name}-${i}-${b}` }));
      }
    }

    // One brick repair patch per wall, placed deterministically.
    const patchOffset = rng.range(-wall.span * 0.6, wall.span * 0.6);
    const patchSize = wall.axis === 'x' ? [2.2, 2.4, 0.1] : [0.1, 2.4, 2.2];
    brick.push(slab(patchSize, [
      wall.axis === 'x' ? patchOffset : wall.at[0] + inward[0] * 0.27,
      VENUE.floorY + rng.range(1.9, 3.4),
      wall.axis === 'x' ? wall.at[2] + inward[2] * 0.27 : patchOffset
    ], { name: `warehouse-brick-patch-${wall.name}` }));
  }

  return assemble('asset.warehouse.walls', [
    { name: 'warehouse-wall-concrete', material: mat('concrete', 3), meshes: concrete },
    { name: 'warehouse-wall-dado-paint', material: mat('paintGreen', 0), meshes: dado },
    { name: 'warehouse-wall-pilasters', material: mat('concreteDark', 0), meshes: ribs },
    { name: 'warehouse-window-boards', material: mat('timber', 1), meshes: windows },
    { name: 'warehouse-brick-repair', material: mat('brick', 0), meshes: brick }
  ]);
}

/**
 * A single structural column: concrete shaft, steel collar, corbel head.
 * Placed many times by the scene.
 *
 * @returns {object} MeshIR
 */
function buildColumn() {
  const height = VENUE.trussY - VENUE.floorY + 0.4;
  const shaft = [
    slab([0.62, height, 0.62], [0, height / 2, 0], { name: 'warehouse-column-shaft' }),
    slab([0.86, 0.22, 0.86], [0, 0.11, 0], { name: 'warehouse-column-plinth' }),
    slab([0.9, 0.26, 0.9], [0, height - 0.13, 0], { name: 'warehouse-column-corbel' })
  ];
  const steel = [
    slab([0.72, 0.1, 0.72], [0, 1.62, 0], { name: 'warehouse-column-collar' }),
    ...repeat(4, (i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return rod({ radius: 0.026, length: 0.1, at: [Math.cos(a) * 0.33, 1.62, Math.sin(a) * 0.33], dir: [Math.cos(a), 0, Math.sin(a)], segments: 6, name: `warehouse-column-bolt-${i}` });
    })
  ];
  return assemble('asset.warehouse.column', [
    { name: 'warehouse-column-concrete', material: mat('concrete', 2), meshes: shaft },
    { name: 'warehouse-column-steelwork', material: mat('steel', 1), meshes: steel }
  ]);
}

/**
 * Roof: corrugated deck, purlins, and lattice trusses spanning the short axis.
 *
 * @returns {object} MeshIR
 */
function buildRoof() {
  const deck = [];
  const purlins = [];
  const chords = [];
  const webs = [];
  const y = VENUE.wallTop;

  // Corrugated deck ribs. Very little light reaches this, but the ribs catch
  // the gantry bounce and stop the ceiling reading as a void.
  const ribs = 46;
  for (let i = 0; i < ribs; i += 1) {
    const x = -VENUE.halfX + ((i + 0.5) / ribs) * VENUE.halfX * 2;
    deck.push(slab([0.2, 0.12, VENUE.halfZ * 2], [x, y + 0.06, 0], { name: `warehouse-roof-rib-${i}` }));
  }
  deck.push(slab([VENUE.halfX * 2, 0.1, VENUE.halfZ * 2], [0, y - 0.05, 0], { name: 'warehouse-roof-deck' }));

  // Purlins along the length.
  for (let i = 0; i < 9; i += 1) {
    const z = -VENUE.halfZ + ((i + 0.5) / 9) * VENUE.halfZ * 2;
    purlins.push(slab([VENUE.halfX * 2, 0.18, 0.12], [0, y - 0.24, z], { name: `warehouse-roof-purlin-${i}` }));
  }

  // Five lattice trusses across the short axis.
  const trussCount = 5;
  for (let t = 0; t < trussCount; t += 1) {
    const z = -VENUE.halfZ + 2.4 + (t / (trussCount - 1)) * (VENUE.halfZ * 2 - 4.8);
    const top = VENUE.trussY + 0.85;
    const bottom = VENUE.trussY;
    chords.push(slab([VENUE.halfX * 2 - 1, 0.16, 0.22], [0, top, z], { name: `warehouse-truss-top-${t}` }));
    chords.push(slab([VENUE.halfX * 2 - 1, 0.16, 0.22], [0, bottom, z], { name: `warehouse-truss-bottom-${t}` }));
    const panels = 14;
    for (let p = 0; p <= panels; p += 1) {
      const x = -VENUE.halfX + 0.5 + (p / panels) * (VENUE.halfX * 2 - 1);
      webs.push(strut([x, bottom, z], [x, top, z], { radius: 0.045, segments: 5, name: `warehouse-truss-vertical-${t}-${p}` }));
      if (p < panels) {
        const nx = -VENUE.halfX + 0.5 + ((p + 1) / panels) * (VENUE.halfX * 2 - 1);
        webs.push(strut(
          [x, p % 2 === 0 ? bottom : top, z],
          [nx, p % 2 === 0 ? top : bottom, z],
          { radius: 0.036, segments: 5, name: `warehouse-truss-diagonal-${t}-${p}` }
        ));
      }
    }
  }

  // A few lengthwise ties reveal separate structural planes above the ring.
  for(const x of [-7,7])for(let i=0;i<4;i++){
    const z=-9+i*5.6;
    webs.push(strut([x,VENUE.trussY+.76,z],[x,VENUE.trussY+.76,z+5.6],{radius:.025,segments:8,name:'roof-longitudinal-tie-'+x+'-'+i}));
    webs.push(strut([x-1,VENUE.trussY+.76,z],[x+1,VENUE.trussY+.76,z+5.6],{radius:.02,segments:8,name:'roof-plan-brace-'+x+'-'+i}));
  }
  return assemble('asset.warehouse.roof', [
    { name: 'warehouse-roof-deck', material: mat('steel', 3), meshes: deck },
    { name: 'warehouse-roof-purlins', material: mat('rust', 1), meshes: purlins },
    { name: 'warehouse-truss-chords', material: mat('paintRed', 0), meshes: chords },
    { name: 'warehouse-truss-webs', material: mat('paintRed', 2), meshes: webs }
  ]);
}

/**
 * The lighting gantry over the ring: a rectangular truss frame slung from the
 * roof on threaded rod, carrying the four hot lamps and their cabling.
 *
 * The lamp fixtures themselves are a separate asset placed at scene-authored
 * positions, so the lights and their housings cannot drift apart.
 *
 * @returns {object} MeshIR
 */
function buildGantry() {
  const halfX = 4.6;
  const halfZ = 4.2;
  const frame = [];
  const cables = [];
  const drops = [];
  const y = VENUE.gantryY;

  const corners = [[-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ]];
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    frame.push(strut([a[0], y, a[1]], [b[0], y, b[1]], { radius: 0.06, segments: 7, name: `gantry-chord-${i}` }));
    frame.push(strut([a[0], y + 0.42, a[1]], [b[0], y + 0.42, b[1]], { radius: 0.05, segments: 7, name: `gantry-upper-chord-${i}` }));
    // Lattice between the two chords.
    const steps = 7;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const px = a[0] + (b[0] - a[0]) * t;
      const pz = a[1] + (b[1] - a[1]) * t;
      frame.push(strut([px, y, pz], [px, y + 0.42, pz], { radius: 0.026, segments: 5, name: `gantry-web-${i}-${s}` }));
    }
    // Threaded drop rods to the roof.
    drops.push(strut([a[0], y + 0.42, a[1]], [a[0], VENUE.trussY, a[1]], { radius: 0.022, segments: 6, name: `gantry-drop-${i}` }));
  }
  // Cross braces so the frame reads as a rig, not a picture frame.
  frame.push(strut([-halfX, y, -halfZ], [halfX, y, halfZ], { radius: 0.035, segments: 6, name: 'gantry-brace-a' }));
  frame.push(strut([halfX, y, -halfZ], [-halfX, y, halfZ], { radius: 0.035, segments: 6, name: 'gantry-brace-b' }));

  // Power cabling, sagging between the lamp positions and running to the wall.
  const lampPositions = [[-2.6, -2.4], [2.6, -2.4], [2.6, 2.4], [-2.6, 2.4]];
  for (let i = 0; i < lampPositions.length; i += 1) {
    const a = lampPositions[i];
    const b = lampPositions[(i + 1) % lampPositions.length];
    const points = [];
    for (let s = 0; s <= 6; s += 1) {
      const t = s / 6;
      points.push([
        a[0] + (b[0] - a[0]) * t,
        y + 0.3 - Math.sin(t * Math.PI) * 0.22,
        a[1] + (b[1] - a[1]) * t
      ]);
    }
    cables.push(tube({ points, radius: 0.016, segments: 5, semanticName: `gantry-cable-${i}` }));
  }
  cables.push(tube({
    points: [
      [-2.6, y + 0.3, -2.4], [-5.5, y + 0.45, -4.5], [-9, y + 0.2, -7.5],
      [-12.5, y - 0.4, -10.5], [-VENUE.halfX + 0.6, VENUE.floorY + 2.4, -VENUE.halfZ + 1.2]
    ],
    radius: 0.018,
    segments: 5,
    semanticName: 'gantry-feed-cable'
  }));

  return assemble('asset.warehouse.gantry', [
    { name: 'lighting-gantry-frame', material: mat('steel', 0), meshes: frame },
    { name: 'lighting-gantry-drops', material: mat('steelWorn', 2), meshes: drops },
    { name: 'lighting-gantry-cabling', material: mat('rubber', 0), meshes: cables }
  ], {
    anchors: lampPositions.map((p, i) => createAnchor({ name: `gantry.lamp.${i}`, position: [p[0], y, p[1]] }))
  });
}

/**
 * One hot overhead fixture: conical shade, wire cage, hot bulb, yoke.
 *
 * @param {object} [options]
 * @returns {object} MeshIR
 */
function buildLamp({ id = 'asset.lamp.key', shadeMaterial = mat('lampDish', 0), bulbMaterial = mat('bulb', 0), radius = 0.46 } = {}) {
  const shade = revolve({
    profile: [
      [0.05, 0.34], [0.07, 0.3], [0.09, 0.26], [radius * 0.55, 0.12], [radius, 0], [radius * 0.98, -0.02], [radius * 0.5, 0.09], [0.08, 0.24]
    ],
    semanticName: 'lamp-shade',
    segments: 18
  });
  const housing = [
    revolve({ profile: [[0.075, 0.3], [0.1, 0.33], [0.1, 0.43], [0.07, 0.46], [0.03, 0.47]], semanticName: 'lamp-housing', segments: 12 }),
    rod({ radius: 0.018, length: 0.22, at: [0, 0.56, 0], segments: 6, name: 'lamp-stem' }),
    ...repeat(3, (i) => {
      const a = (i / 3) * Math.PI * 2;
      return strut([Math.cos(a) * 0.2, 0.16, Math.sin(a) * 0.2], [0, 0.44, 0], { radius: 0.009, segments: 4, name: `lamp-yoke-${i}` });
    })
  ];
  const cage = repeat(8, (i) => {
    const a = (i / 8) * Math.PI * 2;
    return strut(
      [Math.cos(a) * radius * 0.96, -0.01, Math.sin(a) * radius * 0.96],
      [Math.cos(a) * 0.1, -0.2, Math.sin(a) * 0.1],
      { radius: 0.007, segments: 4, name: `lamp-cage-rib-${i}` }
    );
  });
  cage.push(revolve({
    profile: [[radius * 0.6, -0.14], [radius * 0.62, -0.15], [radius * 0.6, -0.16]],
    semanticName: 'lamp-cage-ring',
    segments: 16
  }));

  const bulb = [
    revolve({
      profile: [[0, -0.02], [0.06, -0.04], [0.085, -0.1], [0.075, -0.17], [0.04, -0.2], [0, -0.21]],
      semanticName: 'lamp-bulb',
      segments: 12
    })
  ];

  return assemble(id, [
    { name: 'lamp-reflector', material: shadeMaterial, meshes: [shade] },
    { name: 'lamp-housing', material: mat('lampHousing', 0), meshes: housing },
    { name: 'lamp-cage', material: mat('steelWorn', 1), meshes: cage },
    { name: 'lamp-bulb', material: bulbMaterial, meshes: bulb }
  ]);
}

/**
 * Wall services: pipe runs, conduit drops, junction boxes, a vent and a fan.
 *
 * @returns {object} MeshIR
 */
function buildServices() {
  const rng = createSeededRandom(4409);
  const pipes = [];
  const conduit = [];
  const boxes = [];
  const vents = [];
  const brackets = [];

  const runY = VENUE.floorY + 6.0;
  // Two long pipe runs along the east wall with a bend into the north wall.
  for (let i = 0; i < 3; i += 1) {
    const y = runY + i * 0.34;
    const x = VENUE.halfX - 0.75 - i * 0.1;
    pipes.push(tube({
      points: [
        [x, y, VENUE.halfZ - 0.6],
        [x, y, -VENUE.halfZ + 3.2],
        [x - 1.6, y + 0.12, -VENUE.halfZ + 1.1],
        [-2, y + 0.12, -VENUE.halfZ + 0.9]
      ],
      radius: 0.085 - i * 0.016,
      segments: 8,
      semanticName: `warehouse-pipe-run-${i}`
    }));
  }
  // Brackets holding them to the wall.
  for (let i = 0; i < 12; i += 1) {
    const z = VENUE.halfZ - 1.2 - i * 1.8;
    brackets.push(slab([0.5, 0.08, 0.1], [VENUE.halfX - 0.6, runY + 0.34, z], { name: `warehouse-pipe-bracket-${i}` }));
  }

  // Conduit dropping from the roof to wall boxes, on three walls.
  const dropSpots = [
    [-VENUE.halfX + 0.45, -VENUE.halfZ + 4.5],
    [-VENUE.halfX + 0.45, VENUE.halfZ - 3.2],
    [VENUE.halfX - 0.45, VENUE.halfZ - 6.5],
    [-3.5, -VENUE.halfZ + 0.5]
  ];
  dropSpots.forEach((spot, i) => {
    const boxY = VENUE.floorY + 1.75 + rng.range(-0.2, 0.35);
    conduit.push(tube({
      points: [
        [spot[0], VENUE.trussY, spot[1]],
        [spot[0], VENUE.floorY + 4.0, spot[1]],
        [spot[0], boxY + 0.35, spot[1]]
      ],
      radius: 0.035,
      segments: 6,
      semanticName: `warehouse-conduit-${i}`
    }));
    boxes.push(roundedBox({
      size: [0.42, 0.56, 0.24], radius: 0.03, semanticName: `warehouse-utility-box-${i}`,
      origin: [spot[0] + Math.sign(-spot[0]) * 0.12, boxY, spot[1]]
    }));
    boxes.push(slab([0.1, 0.1, 0.06], [spot[0] + Math.sign(-spot[0]) * 0.24, boxY - 0.14, spot[1]], { name: `warehouse-utility-switch-${i}` }));
  });

  // Extract fan and a louvred vent high on the west wall.
  const fanCentre = [-VENUE.halfX + 0.4, VENUE.floorY + 6.4, 2.5];
  vents.push(place(assembleVentBlades(), { at: fanCentre, rotate: [0, 0, Math.PI / 2] }));
  vents.push(place(revolve({
    profile: [[0.55, 0], [0.62, 0.06], [0.62, 0.26], [0.55, 0.32], [0.26, 0.32], [0.26, 0]],
    semanticName: 'warehouse-fan-housing',
    segments: 14
  }), { at: fanCentre, rotate: [0, 0, Math.PI / 2] }));
  vents.push(...repeat(6, (i, t) => slab(
    [0.08, 0.07, 1.5],
    [-VENUE.halfX + 0.3, VENUE.floorY + 5.2 + t * 0.6, -4.5],
    { name: `warehouse-louvre-${i}`, rotate: [0.4, 0, 0] }
  )));

  conduit.push(tube({points:[[-6,VENUE.trussY,-3],[-5,VENUE.trussY-.18,-3],[-3,VENUE.trussY-.29,-3],[0,VENUE.trussY-.12,-3]],radius:.022,segments:8,semanticName:'suspended-gantry-feed'}));
  boxes.push(roundedBox({size:[.27,.19,.17],radius:.015,origin:[-6,VENUE.trussY,-3],semanticName:'ceiling-junction-box'}));
  brackets.push(...chain({from:[7,VENUE.trussY,-5],to:[7,VENUE.trussY-1.35,-5],links:22,linkRadius:.029,thickness:.006,name:'service-hoist-chain'}));
  return assemble('asset.warehouse.services', [
    { name: 'warehouse-pipe-runs', material: mat('rust', 0), meshes: pipes },
    { name: 'warehouse-pipe-brackets', material: mat('steel', 2), meshes: brackets },
    { name: 'warehouse-conduit', material: mat('steelWorn', 3), meshes: conduit },
    { name: 'warehouse-utility-boxes', material: mat('paintGreen', 2), meshes: boxes },
    { name: 'warehouse-ventilation', material: mat('steel', 3), meshes: vents.filter(Boolean) }
  ]);
}

/**
 * Fan blades, authored separately so the housing and the blades can share one
 * transform.
 *
 * @returns {object} MeshIR
 */
function assembleVentBlades() {
  const blades = repeat(5, (i) => {
    const a = (i / 5) * Math.PI * 2;
    return place(
      roundedBox({ size: [0.4, 0.02, 0.14], radius: 0.01, semanticName: `warehouse-fan-blade-${i}` }),
      { at: [Math.cos(a) * 0.24, 0.15, Math.sin(a) * 0.24], rotate: [0.4, -a, 0] }
    );
  });
  return assemble('asset.warehouse.fanblades', [
    { name: 'warehouse-fan-blades', material: mat('steelWorn', 0), meshes: blades }
  ]);
}

/**
 * The loading door: a roller shutter with visible slats, its guide rails, the
 * barrel housing, and a man door with an exit sign beside it.
 *
 * @returns {object} MeshIR
 */
function buildDoors() {
  const slats = [];
  const rails = [];
  const manDoor = [];
  const sign = [];

  const doorW = 4.2;
  const doorH = 4.4;
  const z = -VENUE.halfZ + 0.28;

  const slatCount = 26;
  for (let i = 0; i < slatCount; i += 1) {
    const y = VENUE.floorY + 0.1 + (i + 0.5) * (doorH / slatCount);
    slats.push(place(
      createBoxMesh({ width: doorW, height: doorH / slatCount - 0.012, depth: 0.09, semanticName: `warehouse-door-slat-${i}` }),
      { at: [0, y, z], rotate: [i % 2 === 0 ? 0.03 : -0.03, 0, 0] }
    ));
  }
  rails.push(slab([0.18, doorH + 0.6, 0.26], [-doorW / 2 - 0.09, VENUE.floorY + doorH / 2 + 0.2, z], { name: 'warehouse-door-rail-west' }));
  rails.push(slab([0.18, doorH + 0.6, 0.26], [doorW / 2 + 0.09, VENUE.floorY + doorH / 2 + 0.2, z], { name: 'warehouse-door-rail-east' }));
  rails.push(rod({ radius: 0.28, length: doorW + 0.5, at: [0, VENUE.floorY + doorH + 0.42, z], dir: [1, 0, 0], segments: 12, name: 'warehouse-door-barrel' }));
  rails.push(slab([doorW + 0.7, 0.24, 0.4], [0, VENUE.floorY + doorH + 0.78, z], { name: 'warehouse-door-lintel' }));

  const mx = 6.4;
  manDoor.push(slab([1.0, 2.15, 0.1], [mx, VENUE.floorY + 1.075, -VENUE.halfZ + 0.22], { name: 'warehouse-man-door' }));
  manDoor.push(slab([1.16, 2.3, 0.16], [mx, VENUE.floorY + 1.15, -VENUE.halfZ + 0.3], { name: 'warehouse-man-door-frame' }));
  manDoor.push(rod({ radius: 0.026, length: 0.36, at: [mx + 0.38, VENUE.floorY + 1.05, -VENUE.halfZ + 0.16], segments: 6, name: 'warehouse-man-door-bar' }));

  sign.push(slab([0.62, 0.24, 0.06], [mx, VENUE.floorY + 2.55, -VENUE.halfZ + 0.3], { name: 'warehouse-exit-sign' }));

  return assemble('asset.warehouse.doors', [
    { name: 'warehouse-roller-door-slats', material: mat('paintGreen', 1), meshes: slats },
    { name: 'warehouse-door-hardware', material: mat('steel', 1), meshes: rails },
    { name: 'warehouse-man-door', material: mat('rust', 2), meshes: manDoor },
    { name: 'warehouse-exit-sign', material: mat('exitSign', 0), meshes: sign }
  ]);
}

/**
 * Builds every warehouse asset.
 *
 * @returns {Map<string, object>}
 */
export function buildWarehouseAssets() {
  const assets = new Map();
  assets.set('asset.warehouse.floor', buildFloor());
  assets.set('asset.warehouse.walls', buildWalls());
  assets.set('asset.warehouse.column', buildColumn());
  assets.set('asset.warehouse.roof', buildRoof());
  assets.set('asset.warehouse.gantry', buildGantry());
  assets.set('asset.warehouse.services', buildServices());
  assets.set('asset.warehouse.doors', buildDoors());
  assets.set('asset.lamp.key', buildLamp({ id: 'asset.lamp.key' }));
  assets.set('asset.lamp.red', buildLamp({ id: 'asset.lamp.red', shadeMaterial: mat('paintRed', 1), bulbMaterial: mat('bulbRed', 0), radius: 0.3 }));
  assets.set('asset.lamp.blue', buildLamp({ id: 'asset.lamp.blue', shadeMaterial: mat('paintGreen', 2), bulbMaterial: mat('bulbBlue', 0), radius: 0.3 }));
  // A single caged work lamp is what someone actually hangs over a pair of
  // heavy bags. Small, dim, and the only reason that corner of the room exists
  // to the eye.
  assets.set('asset.lamp.work', buildLamp({ id: 'asset.lamp.work', shadeMaterial: mat('rust', 1), bulbMaterial: mat('bulb', 0), radius: 0.24 }));
  return assets;
}
