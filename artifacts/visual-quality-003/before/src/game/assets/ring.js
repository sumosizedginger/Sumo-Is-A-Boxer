/**
 * SUMO IS A BOXER — The ring.
 *
 * Authored entirely from Geometry Forge's public modeling verbs plus the
 * game-owned MeshIR generators in kit.js. No imported mesh, no DCC tool.
 *
 * COORDINATE CONTRACT FOR THE WHOLE GAME:
 *   y = 0            the canvas fighting surface
 *   y = -1.05        the warehouse concrete floor
 *   -Z               north; the RED corner is north-west, BLUE is south-east
 *   +-3.15 in x/z    the fighting area the fighters are clamped to
 */

import {
  place, slab, rod, strut, tube, revolve, roundedBox, repeat, assemble,
  createBoxMesh, createSeededRandom, quat
} from './kit.js';
import { sculpt } from './sculpt.js';
import { mat } from './materials.js';
import { createAnchor } from '@sumosizedginger/my-game-engine-1.0/full';

export const RING = Object.freeze({
  /** Half-extent of the fighting area. Fighters are clamped to this. */
  fightHalf: 3.15,
  /** Post centres. */
  postHalf: 3.42,
  /** Half-extent of the raised platform including apron. */
  platformHalf: 4.25,
  /** Canvas surface. */
  canvasY: 0,
  /** Warehouse floor relative to the canvas. */
  floorY: -1.05,
  /** Rope heights above the canvas. */
  ropeY: Object.freeze([0.46, 0.85, 1.24]),
  ropeNames: Object.freeze(['low', 'mid', 'top']),
  postTop: 1.52,
  corners: Object.freeze({
    red: [-1, -1],
    blue: [1, 1],
    neutralNorthEast: [1, -1],
    neutralSouthWest: [-1, 1]
  })
});

const SIDES = Object.freeze([
  { name: 'north', a: [-1, -1], b: [1, -1] },
  { name: 'east', a: [1, -1], b: [1, 1] },
  { name: 'south', a: [1, 1], b: [-1, 1] },
  { name: 'west', a: [-1, 1], b: [-1, -1] }
]);

const cornerMaterial = (corner, seed) => {
  if (corner === 'red') return mat('cornerRed', seed);
  if (corner === 'blue') return mat('cornerBlue', seed);
  return mat('cornerNeutral', seed);
};

const cornerOf = (sx, sz) => {
  if (sx < 0 && sz < 0) return 'red';
  if (sx > 0 && sz > 0) return 'blue';
  return 'neutral';
};

/**
 * The raised platform: structural deck, the canvas itself as a patchwork of
 * worn panels, the edge trim and the hanging apron skirt.
 *
 * The canvas is authored as a GRID of tiles rather than one quad. Material
 * Forge has no texture pathway, so tile-level material variation is how a
 * fought-on, sweat-darkened surface is expressed (ENGINE_GAPS.md — GAP-06).
 *
 * @returns {object} MeshIR
 */
function buildPlatform() {
  const rng = createSeededRandom(5511);
  const half = RING.platformHalf;
  const deckTop = -0.02;

  // --- structural deck ----------------------------------------------------
  const deck = [
    slab([half * 2, 0.22, half * 2], [0, deckTop - 0.11, 0], { name: 'ring-deck-slab' }),
    // Visible under-structure beams at the platform edge.
    ...repeat(7, (i, t) => slab(
      [half * 2 - 0.1, 0.16, 0.14],
      [0, deckTop - 0.30, -half + 0.4 + t * (half * 2 - 0.8)],
      { name: `ring-deck-joist-${i}` }
    )),
    ...repeat(4, (i, t) => slab(
      [0.16, 0.7, 0.16],
      [(t - 0.5) * 2 * (half - 0.55), RING.floorY + 0.35, -half + 0.55],
      { name: `ring-leg-n-${i}` }
    )),
    ...repeat(4, (i, t) => slab(
      [0.16, 0.7, 0.16],
      [(t - 0.5) * 2 * (half - 0.55), RING.floorY + 0.35, half - 0.55],
      { name: `ring-leg-s-${i}` }
    ))
  ];

  // --- canvas patchwork ---------------------------------------------------
  const canvasTiles=[slab([half*2,.05,half*2],[0,-.025,0],{name:'ring-canvas-sheet'})];
  const stainTiles=[];
  // History follows the fighting lanes and corners, not a random checkerboard.
  for(const [zone,cx,cz,rx,rz] of [['lead',-.55,.6,1.1,.5],['rear',.45,-.5,.8,.6],['red',-2.85,-2.8,.53,.63],['blue',2.8,2.75,.54,.6]]){
    const patch=sculpt({name:'canvas-wear-'+zone,segments:48,sections:[[.001,rx,rz],[.001,.001,.001]],shape(p,{angle,row}){
      if(row===0){const irregular=1+.08*Math.sin(angle*5)+.04*Math.cos(angle*11);p[0]*=irregular;p[2]*=irregular;}
    }});
    stainTiles.push(place(patch,{at:[cx,0,cz]}));
    for(let i=0;i<9;i++){
      const theta=i*2.399, x=cx+Math.cos(theta)*rx*.75, z=cz+Math.sin(theta)*rz*.75;
      stainTiles.push(place(sculpt({name:'canvas-pivot-scuff-'+zone+'-'+i,sections:[[.0015,.08+i%3*.018,.009],[.0015,.001,.001]],segments:12}),{at:[x,0,z],rotate:[0,theta,0]}));
    }
  }

  // A faded painted medallion at centre ring.
  const medallion = revolve({
    profile: [[0, 0.002], [0.62, 0.002], [0.62, 0.006], [0.78, 0.006], [0.78, 0.002], [0.95, 0.002]],
    semanticName: 'ring-centre-medallion',
    segments: 28
  });

  // --- trim and apron -----------------------------------------------------
  const trim = [];
  const apron = [];
  const apronStripe = [];
  for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const along = sx === 0 ? 'x' : 'z';
    const length = half * 2 + 0.06;
    const size = along === 'x' ? [length, 0.1, 0.1] : [0.1, 0.1, length];
    trim.push(slab(size, [sx * half, deckTop - 0.05, sz * half], { name: `ring-edge-trim-${sx}${sz}` }));

    // Skirt panels, each very slightly rotated so the cloth is not a flat wall.
    const panels = 9;
    for (let i = 0; i < panels; i += 1) {
      const t = (i + 0.5) / panels - 0.5;
      const offset = t * (half * 2 - 0.1);
      const panelW = (half * 2) / panels + 0.02;
      const lean = rng.range(-0.035, 0.035);
      const at = along === 'x'
        ? [offset, RING.floorY + 0.62, sz * (half + 0.02)]
        : [sx * (half + 0.02), RING.floorY + 0.5, offset];
      const rotate = along === 'x' ? [lean, 0, 0] : [0, 0, lean];
      apron.push(place(
        createBoxMesh({
          width: along === 'x' ? panelW : 0.05,
          height: .78,
          depth: along === 'x' ? 0.05 : panelW,
          semanticName: `ring-apron-panel-${sx}${sz}-${i}`
        }),
        { at, rotate }
      ));
      // A faded advertising band across the skirt. Without it the apron is a
      // metre-tall black wall wrapped around the most-looked-at object here.
      apronStripe.push(place(
        createBoxMesh({
          width: along === 'x' ? panelW * 0.98 : 0.035,
          height: 0.26,
          depth: along === 'x' ? 0.035 : panelW * 0.98,
          semanticName: `ring-apron-band-${sx}${sz}-${i}`
        }),
        { at: [at[0] + (along === 'x' ? 0 : sx * 0.024), at[1] + 0.16, at[2] + (along === 'x' ? sz * 0.024 : 0)], rotate }
      ));
    }
  }

  return assemble('asset.ring.platform', [
    { name: 'ring-platform-deck', material: mat('timber', 2), meshes: deck },
    { name: 'ring-canvas', material: mat('canvas', 0), meshes: canvasTiles },
    { name: 'ring-canvas-wear', material: mat('canvasStain', 1), meshes: stainTiles },
    { name: 'ring-centre-medallion', material: mat('canvasStain', 3), meshes: [medallion] },
    { name: 'ring-edge-trim', material: mat('steel', 1), meshes: trim },
    { name: 'ring-apron-skirt', material: mat('apron', 0), meshes: apron },
    { name: 'ring-apron-band', material: mat('cornerRed', 1), meshes: apronStripe }
  ], {
    anchors: [
      createAnchor({ name: 'ring.centre', position: [0, 0, 0] }),
      createAnchor({ name: 'ring.corner.red', position: [-RING.postHalf, 0, -RING.postHalf] }),
      createAnchor({ name: 'ring.corner.blue', position: [RING.postHalf, 0, RING.postHalf] })
    ]
  });
}

/**
 * Corner posts, their padded sleeves and the turnbuckle pads.
 *
 * @returns {object} MeshIR
 */
function buildPosts() {
  const steelParts = [];
  const brightParts = [];
  const padGroups = { red: [], blue: [], neutral: [] };
  const anchors = [];

  const cornerList = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  cornerList.forEach(([sx, sz], index) => {
    const x = sx * RING.postHalf;
    const z = sz * RING.postHalf;
    const corner = cornerOf(sx, sz);

    // Steel core: seen at the base collar and above the top pad.
    steelParts.push(rod({
      radius: 0.045,
      length: RING.postTop + 0.5,
      at: [x, (RING.postTop - 0.5) / 2, z],
      segments: 10,
      name: `post-core-${index}`
    }));
    // Base plate bolted through the deck.
    steelParts.push(roundedBox({
      size: [0.34, 0.05, 0.34], radius: 0.02, semanticName: `post-base-plate-${index}`, origin: [x, 0.01, z]
    }));
    steelParts.push(...repeat(4, (i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return rod({ radius: 0.018, length: 0.05, at: [x + Math.cos(a) * 0.12, 0.045, z + Math.sin(a) * 0.12], segments: 6, name: `post-bolt-${index}-${i}` });
    }));
    // Cap and finial.
    brightParts.push(place(
      revolve({
        profile: [[0.05, 0], [0.085, 0.02], [0.085, 0.07], [0.055, 0.1], [0.02, 0.13], [0, 0.135]],
        semanticName: `post-cap-${index}`,
        segments: 12
      }),
      { at: [x, RING.postTop, z] }
    ));

    // The padded corner sleeve: a soft column facing into the ring.
    const inward = Math.atan2(-sz, -sx);
    const pad = roundedBox({
      size: [0.3, RING.postTop - 0.06, 0.3],
      radius: 0.11,
      semanticName: `corner-pad-${corner}-${index}`
    });
    padGroups[corner].push(place(pad, { at: [x - sx * 0.03, (RING.postTop - 0.06) / 2, z - sz * 0.03], rotation: quat(0, inward, 0) }));

    // Three turnbuckle pads, one per rope, angled to face the fighting area.
    RING.ropeY.forEach((y, level) => {
      const turnbuckle = roundedBox({
        size: [0.46, 0.2, 0.2],
        radius: 0.085,
        semanticName: `turnbuckle-${corner}-${RING.ropeNames[level]}-${index}`
      });
      padGroups[corner].push(place(turnbuckle, {
        at: [x - sx * 0.14, y, z - sz * 0.14],
        rotation: quat(0, inward + Math.PI / 2, 0)
      }));
      for(const [dx,dz] of [[-sx,0],[0,-sz]]) {
        steelParts.push(slab([.075,.11,.075],[x+dx*.15,y,z+dz*.15],{name:'post-clevis-'+index+'-'+level+'-'+dx+dz}));
        brightParts.push(strut([x+dx*.12,y,z+dz*.12],[x+dx*.39,y,z+dz*.39],{radius:.014,segments:10,name:'post-threaded-tension-'+index+'-'+level+'-'+dx+dz}));
        brightParts.push(rod({radius:.023,length:.033,at:[x+dx*.33,y,z+dz*.33],dir:[dx,0,dz],segments:6,name:'post-locknut-'+index+'-'+level+'-'+dx+dz}));
      }
      // Lace tie-downs across the pad.
      brightParts.push(...repeat(3, (i, t) => rod({
        radius: 0.008,
        length: 0.24,
        at: [
          x - sx * 0.15 + Math.cos(inward + Math.PI / 2) * (t - 0.5) * 0.3,
          y,
          z - sz * 0.15 + Math.sin(inward + Math.PI / 2) * (t - 0.5) * 0.3
        ],
        dir: [Math.cos(inward), 0.15, Math.sin(inward)],
        segments: 5,
        name: `turnbuckle-lace-${index}-${level}-${i}`
      })));
    });

    anchors.push(createAnchor({ name: `post.${corner}.${index}`, position: [x, RING.postTop, z] }));
  });

  return assemble('asset.ring.posts', [
    { name: 'ring-post-steel', material: mat('steel', 0), meshes: steelParts },
    { name: 'ring-post-hardware', material: mat('steelWorn', 1), meshes: brightParts.filter(Boolean) },
    { name: 'corner-padding-red', material: cornerMaterial('red', 0), meshes: padGroups.red },
    { name: 'corner-padding-blue', material: cornerMaterial('blue', 0), meshes: padGroups.blue },
    { name: 'corner-padding-neutral', material: cornerMaterial('neutral', 0), meshes: padGroups.neutral }
  ], { anchors });
}

/**
 * Three rope levels on four sides, with sag, bindings and tensioner hardware.
 *
 * Each of the twelve cords is its OWN named part — `top-rope-north`,
 * `mid-rope-east` and so on — because the brief's semantic vocabulary names
 * them and a validator should be able to find them. The forty-eight bindings
 * and the hardware are fused into two shared parts, because nothing downstream
 * needs to address an individual binding.
 *
 * @returns {object} MeshIR
 */
function buildRopes() {
  const rng = createSeededRandom(7742);
  const groups = [];
  const bindings = [];
  const hardware = [];

  RING.ropeY.forEach((y, level) => {
    const name = RING.ropeNames[level];
    for (const side of SIDES) {
      const ax = side.a[0] * RING.postHalf;
      const az = side.a[1] * RING.postHalf;
      const bx = side.b[0] * RING.postHalf;
      const bz = side.b[1] * RING.postHalf;

      // A rope under tension still sags. 26 mm at mid-span reads as rope
      // rather than as a steel bar.
      const samples = 25;
      const points = [];
      for (let i = 0; i < samples; i += 1) {
        const t = i / (samples - 1);
        const sag = 4*t*(1-t)*(0.042-level*.006);
        points.push([
          ax + (bx - ax) * t,
          y - sag,
          az + (bz - az) * t
        ]);
      }

      groups.push({
        name: `${name}-rope-${side.name}`,
        material: mat('rope', `${name}${side.name}`),
        meshes: [tube({ points, radius: 0.028, segments: 7, semanticName: `${name}-rope-${side.name}` })]
      });

      // Cloth bindings at regular intervals — the detail that makes a rope look
      // used rather than extruded.
      const bindCount = 4;
      for (let i = 1; i <= bindCount; i += 1) {
        const t = i / (bindCount + 1);
        const sag = 4*t*(1-t)*(0.042-level*.006);
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        bindings.push(rod({
          radius: 0.037,
          length: 0.075 + rng.range(0, 0.03),
          at: [px, y - sag, pz],
          dir: [bx - ax, 0, bz - az],
          segments: 7,
          name: `rope-binding-${name}-${side.name}-${i}`
        }));
      }

      // Tensioner at each end: a sleeve, a hook eye and a turnbuckle body.
      for (const end of [side.a, side.b]) {
        const ex = end[0] * RING.postHalf;
        const ez = end[1] * RING.postHalf;
        const raw = [(ax + bx) / 2 - ex, 0, (az + bz) / 2 - ez];
        const rawLen = Math.hypot(raw[0], raw[2]) || 1;
        const inward = [raw[0] / rawLen, 0, raw[2] / rawLen];
        hardware.push(rod({
          radius: 0.026, length: 0.16, at: [ex + inward[0] * 0.09, y, ez + inward[2] * 0.09], dir: inward, segments: 6,
          name: `rope-tensioner-${name}-${side.name}-${end[0]}${end[1]}`
        }));
        hardware.push(place(
          revolve({
            profile: [[0.012, 0], [0.032, 0.014], [0.032, 0.052], [0.012, 0.066]],
            semanticName: `rope-eye-${name}-${side.name}-${end[0]}${end[1]}`,
            segments: 8
          }),
          { at: [ex - inward[0] * 0.02, y - 0.033, ez - inward[2] * 0.02] }
        ));
      }
    }
  });

  // Two vertical spacers per side keep the three tensioned ropes together.
  for(const side of SIDES){for(const t of [.34,.66]){
    const x=(side.a[0]+(side.b[0]-side.a[0])*t)*RING.postHalf;
    const z=(side.a[1]+(side.b[1]-side.a[1])*t)*RING.postHalf;
    const points=RING.ropeY.map((y,i)=>[x,y-4*t*(1-t)*(.042-i*.006),z]);
    const alongX=side.a[0]!==side.b[0];
    bindings.push(slab(alongX?[.042,.82,.009]:[.009,.82,.042],[x,.829,z],{name:'rope-spacer-'+side.name+'-'+t}));
    for(const [i,p] of points.entries()){
      hardware.push(rod({radius:.009,length:.014,at:p,dir:alongX?[0,0,1]:[1,0,0],segments:8,name:'spacer-rivet-'+side.name+'-'+t+'-'+i}));
    }
  }}
  groups.push({ name: 'rope-bindings', material: mat('ropeBinding', 0), meshes: bindings });
  groups.push({ name: 'rope-hardware', material: mat('steelWorn', 2), meshes: hardware });

  return assemble('asset.ring.ropes', groups);
}

/**
 * Ring access stairs for one corner.
 *
 * @param {string} corner - 'red' | 'blue'
 * @returns {object} MeshIR
 */
function buildSteps(corner) {
  const treads = [];
  const frame = [];
  const rails = [];
  const stepCount = 3;
  const width = 1.1;

  for (let i = 0; i < stepCount; i += 1) {
    const y = RING.floorY + 0.18 + i * 0.32;
    const z = 0.62 - i * 0.3;
    treads.push(roundedBox({
      size: [width, 0.06, 0.3], radius: 0.02, semanticName: `ring-step-tread-${corner}-${i}`, origin: [0, y, z]
    }));
    frame.push(slab([0.05, 0.32, 0.05], [-width / 2 + 0.05, y - 0.16, z], { name: `ring-step-leg-l-${corner}-${i}` }));
    frame.push(slab([0.05, 0.32, 0.05], [width / 2 - 0.05, y - 0.16, z], { name: `ring-step-leg-r-${corner}-${i}` }));
  }
  // Stringers and a hand rail.
  frame.push(strut([-width / 2, RING.floorY, 0.78], [-width / 2, -0.05, -0.02], { radius: 0.03, name: `ring-step-stringer-l-${corner}` }));
  frame.push(strut([width / 2, RING.floorY, 0.78], [width / 2, -0.05, -0.02], { radius: 0.03, name: `ring-step-stringer-r-${corner}` }));
  rails.push(strut([-width / 2 - 0.02, RING.floorY + 0.95, 0.75], [-width / 2 - 0.02, 0.35, 0.0], { radius: 0.022, name: `ring-step-rail-l-${corner}` }));
  rails.push(strut([width / 2 + 0.02, RING.floorY + 0.95, 0.75], [width / 2 + 0.02, 0.35, 0.0], { radius: 0.022, name: `ring-step-rail-r-${corner}` }));
  rails.push(strut([-width / 2 - 0.02, RING.floorY + 0.95, 0.75], [-width / 2 - 0.02, RING.floorY, 0.78], { radius: 0.022, name: `ring-step-post-l-${corner}` }));
  rails.push(strut([width / 2 + 0.02, RING.floorY + 0.95, 0.75], [width / 2 + 0.02, RING.floorY, 0.78], { radius: 0.022, name: `ring-step-post-r-${corner}` }));

  return assemble(`asset.ring.steps.${corner}`, [
    { name: `ring-steps-tread-${corner}`, material: corner === 'red' ? mat('paintRed', 1) : mat('paintGreen', 1), meshes: treads },
    { name: `ring-steps-frame-${corner}`, material: mat('steel', 2), meshes: frame },
    { name: `ring-steps-rail-${corner}`, material: mat('steelWorn', 0), meshes: rails }
  ]);
}

/**
 * Corner stool and bucket, one per fighting corner.
 *
 * @param {string} corner
 * @returns {object} MeshIR
 */
function buildCornerKit(corner) {
  const seat = revolve({
    profile: [[0, 0.42], [0.16, 0.42], [0.17, 0.4], [0.17, 0.38], [0.05, 0.37], [0.04, 0.06], [0.09, 0.02], [0.09, 0]],
    semanticName: `corner-stool-${corner}`,
    segments: 12
  });
  const legs = repeat(3, (i) => {
    const a = (i / 3) * Math.PI * 2;
    return strut(
      [0, 0.36, 0],
      [Math.cos(a) * 0.19, 0, Math.sin(a) * 0.19],
      { radius: 0.016, name: `corner-stool-leg-${corner}-${i}` }
    );
  });
  const bucket = revolve({
    profile: [[0, 0], [0.13, 0], [0.14, 0.02], [0.16, 0.26], [0.165, 0.28], [0.15, 0.28], [0.13, 0.26], [0.12, 0.02], [0, 0.02]],
    semanticName: `corner-bucket-${corner}`,
    segments: 12
  });
  const towel = [
    place(roundedBox({ size: [0.3, 0.03, 0.16], radius: 0.014, semanticName: `corner-towel-${corner}-a` }), { at: [0.02, 0.44, 0.03], rotate: [0.05, 0.4, 0.08] }),
    place(roundedBox({ size: [0.26, 0.03, 0.14], radius: 0.012, semanticName: `corner-towel-${corner}-b` }), { at: [-0.03, 0.47, -0.02], rotate: [-0.03, -0.2, -0.06] })
  ];

  return assemble(`asset.corner.kit.${corner}`, [
    { name: `corner-stool-seat-${corner}`, material: corner === 'red' ? mat('cornerRed', 2) : mat('cornerBlue', 2), meshes: [seat] },
    { name: `corner-stool-frame-${corner}`, material: mat('steel', 3), meshes: legs },
    { name: `corner-bucket-${corner}`, material: mat('plastic', corner), meshes: [place(bucket, { at: [0.42, 0, 0.12] })] },
    { name: `corner-towel-${corner}`, material: mat('towel', corner), meshes: towel }
  ]);
}

/**
 * Builds every ring asset.
 *
 * @returns {Map<string, object>} asset key -> MeshIR
 */
export function buildRingAssets() {
  const assets = new Map();
  assets.set('asset.ring.platform', buildPlatform());
  assets.set('asset.ring.posts', buildPosts());
  assets.set('asset.ring.ropes', buildRopes());
  assets.set('asset.ring.steps.red', buildSteps('red'));
  assets.set('asset.ring.steps.blue', buildSteps('blue'));
  assets.set('asset.corner.kit.red', buildCornerKit('red'));
  assets.set('asset.corner.kit.blue', buildCornerKit('blue'));
  return assets;
}
