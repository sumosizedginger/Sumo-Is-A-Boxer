/**
 * SUMO IS A BOXER — Hero body sculpt-field system.
 * 
 * Transforms stable guide topology using semantic, local, anisotropic 3D fields
 * to author reference-accurate sumo anatomy (pectoral plates, 3-tier abdomen,
 * glutes, quads, knees, calves, feet, and hands) without procedural ring-banding.
 */

import {
  createFeatureFrame,
  ellipsoidMask,
  composeSculptMasks,
  ellipsoidSculptField,
  directionalSculptField,
  planeSculptField,
  ridgeSculptField,
  creaseSculptField,
  applySculptFields,
  relaxSculptSurface,
  rebuildSculptNormals
} from '@sumosizedginger/my-game-engine-1.0/full';

const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };

/**
 * Builds the full suite of anatomical sculpt fields matching reference sheets 02, 04, 05, 07.
 */
export function buildSumoBodySculptFields(landmarks) {
  const fields = [];

  const volume = (center, radii, strength, direction = [0, 0, 1], mask = () => 1) =>
    ellipsoidSculptField({ center, radii, strength, direction, mask });

  // =========================================================================
  // 1. CHEST / THORAX (Massive ribcage, paired pectoral plates, sternal notch)
  // =========================================================================
  // Ribcage foundation: broad support for pectorals
  fields.push(volume([0, 1.36, 0.06], [0.34, 0.16, 0.24], 0.028, [0, 0, 1]));

  for (const sign of [1, -1]) {
    // Large paired pectoral plates
    fields.push(volume([sign * 0.14, 1.37, 0.17], [0.15, 0.11, 0.14], 0.042, [sign * 0.1, 0.15, 0.98]));
    // Subpectoral inferolateral margin (defines lower curve of pec)
    fields.push(creaseSculptField({
      points: [
        [sign * 0.04, 1.31, 0.20],
        [sign * 0.14, 1.31, 0.18],
        [sign * 0.25, 1.34, 0.13]
      ],
      radius: 0.026,
      strength: 0.016,
      depthRadius: 0.06,
      mask: p => p[2] > 0.08 ? 1 : 0
    }));
  }

  // Sternal notch / midline cleft between pectorals
  fields.push(creaseSculptField({
    points: [
      [0, 1.48, 0.16],
      [0, 1.40, 0.19],
      [0, 1.32, 0.20]
    ],
    radius: 0.028,
    strength: 0.020,
    depthRadius: 0.06,
    mask: p => p[2] > 0.10 ? 1 : 0
  }));

  // =========================================================================
  // 2. ABDOMEN & FLANKS (Upper abdomen + central belly + hanging apron + flanks)
  // =========================================================================
  // Upper abdomen: muscular volume supported by ribcage below sternum
  fields.push(volume([0, 1.25, 0.22], [0.25, 0.09, 0.16], 0.036, [0, 0.1, 0.99]));

  // Central belly: forward projecting dome
  fields.push(volume([0, 1.13, 0.27], [0.27, 0.15, 0.20], 0.062, [0, -0.05, 0.99]));

  // Lower abdomen / apron: heavy hanging fold that droops over pelvic rim
  fields.push(volume([0, 1.01, 0.25], [0.26, 0.12, 0.18], 0.052, [0, -0.35, 0.93]));

  // Inguinal / suprapubic crease under the hanging apron
  fields.push(creaseSculptField({
    points: [
      [-0.24, 0.95, 0.14],
      [-0.12, 0.93, 0.21],
      [0, 0.92, 0.23],
      [0.12, 0.93, 0.21],
      [0.24, 0.95, 0.14]
    ],
    radius: 0.035,
    strength: 0.024,
    depthRadius: 0.07,
    mask: p => p[2] > 0.08 ? 1 : 0
  }));

  // Deep umbilical depression / navel cavity
  fields.push(volume([0, 1.13, 0.33], [0.025, 0.024, 0.035], -0.034, [0, 0, -1]));

  // Lateral flanks / obliques (love handles) — produces wide barrel sumo core
  for (const sign of [1, -1]) {
    fields.push(volume([sign * 0.33, 1.10, 0.02], [0.12, 0.20, 0.15], 0.046, [sign * 0.95, 0, 0.3]));
  }

  // =========================================================================
  // 3. BACK, TRAPS & SHOULDERS (Distinct deltoids, lats, traps, sacral valley)
  // =========================================================================
  for (const sign of [1, -1]) {
    // Deltoids: rounded muscular shoulder caps (NOT a flat continuous shelf)
    fields.push(volume([sign * 0.37, 1.41, 0.00], [0.12, 0.14, 0.12], 0.038, [sign * 0.85, 0.35, 0]));

    // Trapezius: posterior neck-shoulder slope (connecting occiput to clavicle)
    fields.push(volume([sign * 0.16, 1.52, -0.06], [0.13, 0.11, 0.12], 0.032, [sign * 0.2, 0.7, -0.68]));

    // Latissimus dorsi: lateral flare below the axilla
    fields.push(volume([sign * 0.28, 1.30, -0.12], [0.12, 0.16, 0.12], 0.035, [sign * 0.7, 0, -0.7]));
  }

  // Upper back / rhomboid fullness
  fields.push(volume([0, 1.38, -0.16], [0.24, 0.14, 0.12], 0.024, [0, 0, -1]));

  // Triangular sacral valley at top of glutes
  fields.push(volume([0, 1.07, -0.18], [0.06, 0.08, 0.06], -0.022, [0, 0, 1]));

  // =========================================================================
  // 4. GLUTES (Twin major hemispheres, intergluteal cleft, inferior fold)
  // =========================================================================
  for (const sign of [1, -1]) {
    // Major hemispherical glute cheek (strong posterior protrusion matching profile turnaround)
    fields.push(volume([sign * 0.16, 0.98, -0.23], [0.16, 0.16, 0.17], 0.092, [sign * 0.15, -0.08, -0.98]));

    // Inferior gluteal fold: sharp crease under each cheek
    fields.push(creaseSculptField({
      points: [
        [sign * 0.03, 0.88, -0.20],
        [sign * 0.14, 0.87, -0.21],
        [sign * 0.26, 0.89, -0.15]
      ],
      radius: 0.028,
      strength: 0.038,
      depthRadius: 0.07,
      mask: p => p[2] < -0.06 ? 1 : 0
    }));

    // Lateral trochanter / hip fullness
    fields.push(volume([sign * 0.31, 0.94, -0.06], [0.09, 0.14, 0.12], 0.032, [sign * 0.95, 0, -0.3]));
  }

  // Deep vertical intergluteal cleft
  fields.push(creaseSculptField({
    points: [
      [0, 1.08, -0.20],
      [0, 0.97, -0.23],
      [0, 0.86, -0.21]
    ],
    radius: 0.026,
    strength: 0.046,
    depthRadius: 0.09,
    mask: p => p[2] < -0.08 ? 1 : 0
  }));

  // =========================================================================
  // 5. THIGHS (Quadriceps, vastus lateralis, adductors, hamstrings)
  // =========================================================================
  for (const sign of [1, -1]) {
    const lx = sign * 0.18;
    // Quadriceps front sweep
    fields.push(volume([lx, 0.67, 0.11], [0.12, 0.17, 0.11], 0.038, [sign * 0.1, 0, 0.99]));

    // Vastus lateralis: outer thigh power curve
    fields.push(volume([sign * 0.29, 0.68, 0.02], [0.10, 0.17, 0.11], 0.040, [sign * 0.98, 0, 0.1]));

    // Adductor: inner thigh fullness without bridging crotch
    fields.push(volume([sign * 0.11, 0.74, 0.00], [0.06, 0.11, 0.08], 0.016, [sign * -0.6, 0, 0.4]));

    // Hamstrings: posterior thigh curve
    fields.push(volume([lx, 0.65, -0.12], [0.11, 0.16, 0.11], 0.036, [0, 0, -1]));
  }

  // =========================================================================
  // 6. KNEES (Narrowed transition, patellar plate, popliteal recess)
  // =========================================================================
  for (const sign of [1, -1]) {
    const lx = sign * 0.18;
    // Patellar kneecap prominence
    fields.push(volume([lx, 0.44, 0.11], [0.045, 0.055, 0.045], 0.022, [0, 0, 1]));

    // Popliteal fossa: posterior knee hollow
    fields.push(volume([lx, 0.44, -0.07], [0.06, 0.07, 0.05], -0.024, [0, 0, -1]));
  }

  // =========================================================================
  // 7. CALVES & ANKLES (Gastrocnemius heads, lower taper, Achilles tendon)
  // =========================================================================
  for (const sign of [1, -1]) {
    // Medial gastrocnemius head
    fields.push(volume([sign * 0.14, 0.33, -0.09], [0.07, 0.09, 0.08], 0.042, [sign * -0.3, 0, -0.95]));

    // Lateral gastrocnemius head
    fields.push(volume([sign * 0.21, 0.35, -0.08], [0.07, 0.09, 0.08], 0.036, [sign * 0.4, 0, -0.9]));

    // Medial malleolus prominence
    fields.push(volume([sign * 0.125, 0.11, -0.005], [0.022, 0.025, 0.025], 0.014, [sign * -1, 0, 0]));

    // Lateral malleolus prominence (lower than medial)
    fields.push(volume([sign * 0.215, 0.09, -0.015], [0.022, 0.025, 0.025], 0.016, [sign * 1, 0, 0]));

    // Calcaneus heel projection
    fields.push(volume([sign * 0.17, 0.048, -0.075], [0.055, 0.038, 0.055], 0.038, [0, 0, -1]));

    // Forefoot arch
    fields.push(volume([sign * 0.17, 0.035, 0.09], [0.075, 0.028, 0.055], 0.024, [0, 0, 1]));

    // 5 Distinct Toe Masses (12mm voxel steps)
    // 1. Big toe (medial)
    fields.push(volume([sign * 0.13, 0.026, 0.130], [0.024, 0.022, 0.032], 0.024, [0, 0, 1]));
    // 2. Second toe
    fields.push(volume([sign * 0.15, 0.024, 0.126], [0.020, 0.020, 0.028], 0.020, [0, 0, 1]));
    // 3. Third toe (middle)
    fields.push(volume([sign * 0.17, 0.023, 0.122], [0.018, 0.018, 0.026], 0.018, [0, 0, 1]));
    // 4. Fourth toe
    fields.push(volume([sign * 0.19, 0.022, 0.116], [0.016, 0.016, 0.024], 0.016, [0, 0, 1]));
    // 5. Pinky toe (lateral)
    fields.push(volume([sign * 0.21, 0.020, 0.108], [0.015, 0.015, 0.022], 0.015, [0, 0, 1]));
  }

  // =========================================================================
  // 8. ARMS & HANDS (Biceps/triceps rhythm, thenar pad, knuckle wedge)
  // =========================================================================
  for (const sign of [1, -1]) {
    // Biceps
    fields.push(volume([sign * 0.44, 1.22, 0.03], [0.065, 0.10, 0.065], 0.024, [0, 0, 1]));

    // Triceps
    fields.push(volume([sign * 0.44, 1.24, -0.04], [0.075, 0.11, 0.075], 0.028, [0, 0, -1]));

    // Forearm brachioradialis
    fields.push(volume([sign * 0.43, 0.95, 0.02], [0.055, 0.09, 0.055], 0.020, [sign * 0.5, 0, 0.8]));

    // Thenar (thumb) pad mass (prominent medial fist ball)
    fields.push(volume([sign * 0.41, 0.74, 0.03], [0.035, 0.045, 0.035], 0.026, [sign * -0.7, 0, 0.7]));

    // Knuckle arch
    fields.push(volume([sign * 0.43, 0.67, -0.01], [0.042, 0.028, 0.038], 0.020, [0, 0, -1]));
    fields.push(ridgeSculptField({
      points: [
        [sign * 0.40, 0.67, 0.01],
        [sign * 0.42, 0.67, -0.01],
        [sign * 0.45, 0.67, -0.02]
      ],
      radius: 0.018,
      strength: 0.018,
      depthRadius: 0.04,
      mask: p => 1
    }));
  }

  return fields;
}

/**
 * Applies full sculptural anatomy to the guide body surface and smooths procedural ring bands.
 * 
 * @param {object} surface - Topology surface from generateContinuousBody
 * @param {object} landmarks - Semantic skeleton landmarks
 * @returns {object} Sculpted topology surface
 */
export function sculptSumoBody(surface, landmarks) {
  const fields = buildSumoBodySculptFields(landmarks);
  let sculpted = applySculptFields(surface, fields);

  // Plantar sole grounding: flatten all vertices near the floor so feet plant firmly
  const p = sculpted.attributes.position;
  for (let i = 0; i < p.length; i += 3) {
    const y = p[i + 1];
    if (y < 0.030) {
      // Smoothly level sole onto ground plane y = 0.015
      const t = clamp((0.030 - y) / 0.015);
      p[i + 1] = y * (1 - t) + 0.015 * t;
    }
  }

  // Rebuild normals after sole leveling
  sculpted = rebuildSculptNormals(sculpted);

  // Tangential relaxation: removes horizontal ring-stepping while preserving anatomical features
  sculpted = relaxSculptSurface(sculpted, {
    mask: pt => {
      const y = pt[1];
      // Relax torso, thighs, knees, calves, arms; keep head (y > 1.63) for sculptBoxerHead
      return (y < 1.62 && y > 0.03) ? 1 : 0;
    },
    featureMask: pt => {
      // Protect key anatomical depressions from over-smoothing
      const y = pt[1], x = pt[0], z = pt[2];
      // Gluteal cleft protection
      if (Math.abs(x) < 0.03 && z < -0.10 && y > 0.86 && y < 1.10) return 0.85;
      // Glute fold protection
      if (z < -0.10 && Math.abs(y - 0.88) < 0.04) return 0.80;
      // Navel protection
      if (Math.abs(x) < 0.04 && Math.abs(y - 1.13) < 0.04 && z > 0.25) return 0.90;
      // Sternal notch protection
      if (Math.abs(x) < 0.025 && y > 1.30 && y < 1.50 && z > 0.12) return 0.80;
      // Patella front edge
      if (Math.abs(y - 0.44) < 0.04 && z > 0.09) return 0.70;
      return 0;
    },
    iterations: 6,
    strength: 0.28,
    tangential: true
  });

  return sculpted;
}
