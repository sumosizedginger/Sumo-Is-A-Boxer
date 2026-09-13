/**
 * SUMO IS A BOXER — Fighter equipment and the first-person body.
 *
 * THE FIRST-PERSON HANDS ARE THE MOST-LOOKED-AT GEOMETRY IN THE GAME. They are
 * on screen every frame of the fight, a third of a metre from the camera. Two
 * cubes would sink the whole build, so they get a real forearm taper, a wrist
 * that narrows before the glove flares, wrap banding in the gap between wrap
 * and cuff, a thumb that sits where a thumb sits, a knuckle seam, a laced back
 * and a cuff strap.
 *
 * AUTHORING FRAME for the first-person arms: the limb runs along +Y from the
 * elbow at y = 0 to the glove nose near y = 0.5. The presentation layer rotates
 * that onto the camera's -Z so the same authored asset can be posed by
 * game-owned motion code without baking a pose into the mesh.
 */

import {
  place, rod, revolve, roundedBox, repeat, assemble
} from './kit.js';
import { mat } from './materials.js';
import { createAnchor } from '@sumosizedginger/my-game-engine-1.0/full';

/** Where the glove's contact point sits in the authored frame. */
export const GLOVE_TIP_Y = 0.5;

/**
 * A boxing glove, authored along +Y with its cuff at `cuffY`.
 *
 * @param {object} options
 * @returns {object} Object of MeshIR groups.
 */
function gloveParts({ cuffY = 0.26, side = 1, scale = 1, prefix = 'glove' }) {
  const s = scale;
  const y = (v) => cuffY + v * s;

  // The mitt. Squashed on Z so it is wider across the knuckles than it is deep,
  // which is what makes it read as a glove instead of a sausage.
  const mitt = revolve({
    profile: [
      [0.048 * s, y(0.0)], [0.072 * s, y(0.025)], [0.082 * s, y(0.06)],
      [0.088 * s, y(0.105)], [0.09 * s, y(0.15)], [0.086 * s, y(0.185)],
      [0.072 * s, y(0.212)], [0.042 * s, y(0.232)], [0, y(0.238)]
    ],
    semanticName: `${prefix}-mitt`,
    segments: 16,
    squashZ: 0.76
  });

  // Knuckle roll: the padded ridge across the striking face.
  const knuckle = place(
    revolve({
      profile: [[0.09 * s, y(0.128)], [0.096 * s, y(0.15)], [0.09 * s, y(0.172)]],
      semanticName: `${prefix}-knuckle-roll`,
      segments: 16,
      squashZ: 0.76
    }),
    { at: [0, 0, 0] }
  );

  // Thumb, angled off the inboard side.
  const thumb = place(
    revolve({
      profile: [[0.02 * s, 0], [0.032 * s, 0.02 * s], [0.034 * s, 0.06 * s], [0.026 * s, 0.085 * s], [0, 0.095 * s]],
      semanticName: `${prefix}-thumb`,
      segments: 10
    }),
    { at: [side * 0.062 * s, y(0.055), 0.018 * s], rotate: [0.25, 0, side * -0.85] }
  );

  // Cuff: flared collar with a wrist strap and a buckle tab.
  const cuff = revolve({
    profile: [
      [0.043 * s, y(-0.075)], [0.055 * s, y(-0.065)], [0.06 * s, y(-0.03)],
      [0.056 * s, y(-0.005)], [0.05 * s, y(0.004)]
    ],
    semanticName: `${prefix}-cuff`,
    segments: 14,
    squashZ: 0.9
  });
  const strap = place(
    roundedBox({ size: [0.13 * s, 0.045 * s, 0.055 * s], radius: 0.014 * s, semanticName: `${prefix}-cuff-strap` }),
    { at: [0, y(-0.045), -0.03 * s], rotate: [0.1, 0, 0] }
  );
  const buckle = place(
    roundedBox({ size: [0.03 * s, 0.026 * s, 0.016 * s], radius: 0.005 * s, semanticName: `${prefix}-cuff-buckle` }),
    { at: [side * 0.052 * s, y(-0.045), -0.026 * s] }
  );

  // Laces across the back of the hand.
  const laces = repeat(4, (i, t) => place(
    rod({ radius: 0.0045 * s, length: 0.055 * s, at: [0, 0, 0], dir: [1, 0.25, 0], segments: 4, name: `${prefix}-lace-${i}` }),
    { at: [0, y(0.045 + t * 0.1), -0.06 * s] }
  ));

  return {
    leather: [mitt, cuff],
    trim: [knuckle, thumb, strap],
    hardware: [buckle],
    laces
  };
}

/**
 * A first-person arm: forearm, wrist wraps and glove.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildFirstPersonArm({ id, side, leatherFamily, skinFamily }) {
  // Forearm, tapering from a heavy elbow to a narrow wrist.
  const forearm = revolve({
    profile: [
      [0.058, -0.04], [0.064, 0.0], [0.067, 0.04], [0.063, 0.1],
      [0.055, 0.16], [0.046, 0.2], [0.04, 0.235], [0.038, 0.255]
    ],
    semanticName: `fp-forearm-${side < 0 ? 'left' : 'right'}`,
    segments: 14,
    squashZ: 0.92
  });
  // Forearm musculature: a subtle brachioradialis bulge on the outboard side.
  const muscle = place(
    revolve({
      profile: [[0, 0], [0.022, 0.02], [0.026, 0.06], [0.02, 0.1], [0, 0.12]],
      semanticName: `fp-forearm-muscle-${side < 0 ? 'left' : 'right'}`,
      segments: 10,
      squashZ: 0.7
    }),
    { at: [side * 0.046, 0.045, 0.008], rotate: [0, 0, side * -0.18] }
  );

  // Hand wraps: the tell that this is a fighter, in the gap the cuff leaves.
  const wraps = repeat(5, (i, t) => revolve({
    profile: [
      [0.041 + 0.004 * Math.sin(i * 1.7), 0.19 + t * 0.06],
      [0.045 + 0.004 * Math.sin(i * 1.7), 0.196 + t * 0.06],
      [0.041 + 0.004 * Math.sin(i * 1.7), 0.204 + t * 0.06]
    ],
    semanticName: `fp-wrap-band-${side < 0 ? 'left' : 'right'}-${i}`,
    segments: 12,
    squashZ: 0.92
  }));
  // The tail of the wrap tucked under itself.
  wraps.push(place(
    roundedBox({ size: [0.03, 0.012, 0.05], radius: 0.004, semanticName: `fp-wrap-tail-${side < 0 ? 'left' : 'right'}` }),
    { at: [side * 0.036, 0.222, 0.014], rotate: [0.2, 0, side * 0.5] }
  ));

  const glove = gloveParts({ cuffY: 0.26, side, scale: 1.05, prefix: `fp-glove-${side < 0 ? 'left' : 'right'}` });

  return assemble(id, [
    { name: `fp-forearm-${side < 0 ? 'left' : 'right'}`, material: mat(skinFamily, side), meshes: [forearm, muscle] },
    { name: `fp-hand-wraps-${side < 0 ? 'left' : 'right'}`, material: mat('wraps', side), meshes: wraps },
    { name: `fp-glove-leather-${side < 0 ? 'left' : 'right'}`, material: mat(leatherFamily, 0), meshes: glove.leather },
    { name: `fp-glove-trim-${side < 0 ? 'left' : 'right'}`, material: mat(leatherFamily, 2), meshes: glove.trim },
    { name: `fp-glove-laces-${side < 0 ? 'left' : 'right'}`, material: mat('wraps', 1), meshes: [...glove.laces, ...glove.hardware] }
  ], {
    anchors: [
      createAnchor({ name: 'arm.elbow', position: [0, 0, 0] }),
      createAnchor({ name: 'arm.wrist', position: [0, 0.255, 0] }),
      createAnchor({ name: 'glove.contact', position: [0, GLOVE_TIP_Y, 0] })
    ]
  });
}

/**
 * The opponent's glove, authored to hang off a Character Forge `hand_*` bone.
 *
 * Character Forge's skinned humanoid has one material for the whole body
 * (ENGINE_GAPS.md — GAP-07), so equipment that must read as a DIFFERENT
 * MATERIAL — leather, cloth, rubber — is authored here and attached to the
 * semantic bones the Forge exposes through `bonesByName`.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildOpponentGlove({ id, side, leatherFamily }) {
  const label = side < 0 ? 'left' : 'right';
  const glove = gloveParts({ cuffY: 0.0, side, scale: 1.0, prefix: `boxer-glove-${label}` });
  const wrapCuff = repeat(3, (i, t) => revolve({
    profile: [[0.043, -0.1 + t * 0.03], [0.047, -0.094 + t * 0.03], [0.043, -0.086 + t * 0.03]],
    semanticName: `boxer-wrap-${label}-${i}`,
    segments: 10
  }));

  return assemble(id, [
    { name: `boxer-glove-leather-${label}`, material: mat(leatherFamily, 0), meshes: glove.leather },
    { name: `boxer-glove-trim-${label}`, material: mat(leatherFamily, 2), meshes: glove.trim },
    { name: `boxer-glove-laces-${label}`, material: mat('wraps', 2), meshes: [...glove.laces, ...glove.hardware, ...wrapCuff] }
  ], {
    anchors: [createAnchor({ name: 'glove.contact', position: [0, 0.24, 0] })]
  });
}

/**
 * The opponent's trunks: waistband, panel, side flash and hem.
 * Authored around the origin at the pelvis, to be attached to the pelvis bone.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildTrunks({ id, trimFamily }) {
  const shell = revolve({
    profile: [
      [0.165, 0.16], [0.178, 0.1], [0.186, 0.02], [0.202, -0.07],
      [0.218, -0.14], [0.226, -0.2], [0.218, -0.235], [0.192, -0.245]
    ],
    semanticName: 'boxer-trunks-shell',
    segments: 16,
    squashZ: 0.78
  });
  const inner = revolve({
    profile: [[0.192, -0.245], [0.152, -0.25], [0.152, -0.185], [0.162, -0.15]],
    semanticName: 'boxer-trunks-inner',
    segments: 16,
    squashZ: 0.78
  });
  const waistband = revolve({
    profile: [[0.168, 0.2], [0.182, 0.19], [0.184, 0.12], [0.172, 0.11]],
    semanticName: 'boxer-trunks-waistband',
    segments: 16,
    squashZ: 0.78
  });
  const flash = [
    place(roundedBox({ size: [0.05, 0.33, 0.105], radius: 0.019, semanticName: 'boxer-trunks-flash-left' }), { at: [-0.193, -0.06, 0.02], rotate: [0, 0, -0.08] }),
    place(roundedBox({ size: [0.05, 0.33, 0.105], radius: 0.019, semanticName: 'boxer-trunks-flash-right' }), { at: [0.193, -0.06, 0.02], rotate: [0, 0, 0.08] })
  ];
  const hem = revolve({
    profile: [[0.218, -0.215], [0.231, -0.225], [0.231, -0.24], [0.218, -0.247]],
    semanticName: 'boxer-trunks-hem',
    segments: 16,
    squashZ: 0.78
  });

  return assemble(id, [
    { name: 'boxer-trunks', material: mat('cloth', 0), meshes: [shell, inner] },
    { name: 'boxer-trunks-trim', material: mat(trimFamily, 1), meshes: [waistband, hem, ...flash] }
  ]);
}

/**
 * A boxing boot, authored at the ankle so it can be attached to `foot_*`.
 *
 * @param {object} options
 * @returns {object} MeshIR
 */
function buildBoot({ id, side }) {
  const label = side < 0 ? 'left' : 'right';
  const upper = revolve({
    profile: [[0.052, 0.26], [0.062, 0.2], [0.068, 0.12], [0.072, 0.05], [0.074, 0.0]],
    semanticName: `boxer-boot-upper-${label}`,
    segments: 12,
    squashZ: 0.85
  });
  const foot = place(
    revolve({
      profile: [[0, -0.11], [0.05, -0.105], [0.068, -0.06], [0.072, 0.0], [0.06, 0.04], [0, 0.045]],
      semanticName: `boxer-boot-foot-${label}`,
      segments: 12,
      squashZ: 0.62
    }),
    { at: [0, 0.045, 0.055], rotate: [Math.PI / 2, 0, 0], scale: [1, 1.5, 1] }
  );
  const sole = place(
    roundedBox({ size: [0.098, 0.026, 0.26], radius: 0.012, semanticName: `boxer-boot-sole-${label}` }),
    { at: [0, 0.014, 0.028] }
  );
  const laces = repeat(4, (i, t) => place(
    rod({ radius: 0.005, length: 0.07, at: [0, 0, 0], dir: [1, 0, 0], segments: 4, name: `boxer-boot-lace-${label}-${i}` }),
    { at: [0, 0.07 + t * 0.16, 0.05] }
  ));

  return assemble(id, [
    { name: `boxer-boot-${label}`, material: mat('leatherBlack', 1), meshes: [upper, foot] },
    { name: `boxer-boot-sole-${label}`, material: mat('rubber', 0), meshes: [sole] },
    { name: `boxer-boot-laces-${label}`, material: mat('wraps', 0), meshes: laces }
  ]);
}

/**
 * Face and head detail for the opponent.
 *
 * Character Forge's humanoid head is a smooth lofted ellipsoid with no face: it
 * is a body, not a portrait (ENGINE_GAPS.md — GAP-13). At fighting distance
 * that reads as a mannequin, so the brow ridge, eye sockets, nose, ears, cropped
 * hair, taped eyebrow and mouthguard are authored here and attached to the
 * Forge's own `head` bone.
 *
 * Dimensions are derived from Character Forge's published head parameters
 * (0.046 * height * headScale across, 0.058 deep), not guessed, so the features
 * sit on the surface rather than floating off it or sinking in.
 *
 * @param {object} [options]
 * @returns {object} MeshIR
 */
function buildHeadDetail({ height = 1.86, headScale = 0.97 } = {}) {
  const rx = 0.046 * height * headScale;
  const rz = 0.058 * height * headScale;
  const squash = rz / rx;

  // Cropped hair: a cap over the crown and the back of the skull, pulled
  // slightly rearward so the face is not swallowed by it.
  const hair = place(
    revolve({
      profile: [
        [0, 0.098], [0.03, 0.096], [0.058, 0.084], [0.08, 0.056],
        [0.089, 0.018], [0.088, -0.024], [0.072, -0.05], [0.05, -0.058]
      ],
      semanticName: 'boxer-hair',
      segments: 16,
      squashZ: squash
    }),
    { at: [0, 0, -0.012] }
  );
  // A shaved fade around the temples and nape.
  const fade = place(
    revolve({
      profile: [[0.09, -0.016], [0.093, -0.03], [0.088, -0.052]],
      semanticName: 'boxer-hair-fade',
      segments: 16,
      squashZ: squash
    }),
    { at: [0, 0, -0.012] }
  );

  // FEATURES SIT ON THE SURFACE, NOT ON TOP OF IT. Character Forge's head is a
  // loft that narrows away from its centre station, so a feature placed at the
  // full half-depth stands proud of the skull and reads as a bolted-on ledge.
  // Every depth below is a fraction of `rz` chosen to sink the feature into the
  // loft at the height it sits at, and every feature is small: at fighting
  // distance this head is 100 px tall, and the brow and the eye sockets are the
  // only two shapes that survive that.
  const brow = place(
    roundedBox({ size: [0.098, 0.017, 0.018], radius: 0.008, semanticName: 'boxer-brow-ridge' }),
    { at: [0, 0.024, rz * 0.7], rotate: [0.3, 0, 0] }
  );
  const nose = place(
    revolve({
      profile: [[0, 0.03], [0.009, 0.022], [0.014, 0.004], [0.016, -0.012], [0.011, -0.019], [0, -0.021]],
      semanticName: 'boxer-nose',
      segments: 8,
      squashZ: 1.35
    }),
    { at: [0, -0.006, rz * 0.78], rotate: [Math.PI / 2 - 0.3, 0, 0] }
  );
  const ears = [
    place(revolve({ profile: [[0, 0], [0.011, 0.005], [0.016, 0.015], [0.014, 0.025], [0.008, 0.03], [0, 0.031]], semanticName: 'boxer-ear-left', segments: 8, squashZ: 1.5 }), { at: [rx * 0.9, -0.006, -0.014], rotate: [0, 0, -Math.PI / 2] }),
    place(revolve({ profile: [[0, 0], [0.011, 0.005], [0.016, 0.015], [0.014, 0.025], [0.008, 0.03], [0, 0.031]], semanticName: 'boxer-ear-right', segments: 8, squashZ: 1.5 }), { at: [-rx * 0.9, -0.006, -0.014], rotate: [0, 0, Math.PI / 2] })
  ];

  // Deep-set eyes. Two small dark recesses do more for a procedural face than
  // any amount of extra silhouette detail — provided they are RECESSES.
  const eyes = [
    place(roundedBox({ size: [0.023, 0.011, 0.011], radius: 0.004, semanticName: 'boxer-eye-left' }), { at: [0.031, 0.004, rz * 0.74], rotate: [0.12, 0.2, 0] }),
    place(roundedBox({ size: [0.023, 0.011, 0.011], radius: 0.004, semanticName: 'boxer-eye-right' }), { at: [-0.031, 0.004, rz * 0.74], rotate: [0.12, -0.2, 0] })
  ];
  const mouth = place(
    roundedBox({ size: [0.028, 0.007, 0.009], radius: 0.003, semanticName: 'boxer-mouth-line' }),
    { at: [0, -0.056, rz * 0.66], rotate: [0.35, 0, 0] }
  );

  // The tells of a man who has already been in one of these.
  const brow_tape = place(
    roundedBox({ size: [0.03, 0.01, 0.012], radius: 0.004, semanticName: 'boxer-brow-tape' }),
    { at: [0.036, 0.033, rz * 0.66], rotate: [0.28, -0.3, 0.22] }
  );
  const mouthguard = place(
    revolve({ profile: [[0.014, 0], [0.023, 0.005], [0.023, 0.013], [0.014, 0.017]], semanticName: 'boxer-mouthguard', segments: 8, squashZ: 0.55 }),
    { at: [0, -0.052, rz * 0.7], rotate: [Math.PI / 2 + 0.35, 0, 0] }
  );

  return assemble('asset.boxer.head.detail', [
    { name: 'boxer-hair', material: mat('leatherBlack', 2), meshes: [hair, fade] },
    { name: 'boxer-face-structure', material: mat('skin', 1), meshes: [brow, nose, ...ears] },
    { name: 'boxer-face-recesses', material: mat('concreteStain', 0), meshes: [...eyes, mouth] },
    { name: 'boxer-face-tape', material: mat('wraps', 0), meshes: [brow_tape, mouthguard] }
  ]);
}

/**
 * Builds every fighter-equipment asset.
 *
 * @returns {Map<string, object>}
 */
export function buildFighterKitAssets() {
  const assets = new Map();
  assets.set('asset.fp.arm.left', buildFirstPersonArm({ id: 'asset.fp.arm.left', side: -1, leatherFamily: 'leatherBlue', skinFamily: 'skinPlayer' }));
  assets.set('asset.fp.arm.right', buildFirstPersonArm({ id: 'asset.fp.arm.right', side: 1, leatherFamily: 'leatherBlue', skinFamily: 'skinPlayer' }));
  assets.set('asset.boxer.glove.left', buildOpponentGlove({ id: 'asset.boxer.glove.left', side: -1, leatherFamily: 'leatherRed' }));
  assets.set('asset.boxer.glove.right', buildOpponentGlove({ id: 'asset.boxer.glove.right', side: 1, leatherFamily: 'leatherRed' }));
  assets.set('asset.boxer.trunks', buildTrunks({ id: 'asset.boxer.trunks', trimFamily: 'cornerRed' }));
  assets.set('asset.boxer.boot.left', buildBoot({ id: 'asset.boxer.boot.left', side: -1 }));
  assets.set('asset.boxer.boot.right', buildBoot({ id: 'asset.boxer.boot.right', side: 1 }));
  assets.set('asset.boxer.head.detail', buildHeadDetail());
  return assets;
}
