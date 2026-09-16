/**
 * SUMO IS A BOXER — the opponent's skull loft, as shared authored data.
 *
 * WHY THIS IS ITS OWN MODULE. The hair, the shaved fade and the skull are three
 * surfaces that have to agree to within a couple of millimetres, and they are
 * built in two different places: the skull is skinned geometry authored in
 * `character/hero-guide-body.js`, the hair is a separate asset authored in
 * `assets/hero-kit.js`. When the hair was sized from Character Forge's
 * published head parameters instead of from the skull that actually ships, the
 * two drifted: the hair ran 1.1 mm INSIDE the skull across the temples (visible
 * black/skin z-fighting) and stopped 38 mm below the crown, so the top of the
 * head pushed straight through the cap. Both surfaces now read these numbers.
 *
 * Stations are [y, halfWidth, halfDepth, centreX, centreZ] in the character's
 * BIND space, the same space `hero-guide-body.js` authors in.
 */

/**
 * Shell clearances over the skull, in metres. These are the SHIPPED values and
 * the ones tests/visual-quality.test.js asserts against, so lowering them back
 * into z-fighting range fails the suite rather than the eye.
 */
export const HAIR_SHELL_OFFSET = 0.008;
export const FADE_SHELL_OFFSET = 0.0055;

/** Character Forge's `head` bone height in bind space for BOXER_PARAMETERS. */
export const HEAD_BONE_BIND_Y = 1.7427;

export const SKULL_SECTIONS = [
  [1.623, 0.065, 0.062, 0, 0.021],
  [1.646, 0.078, 0.076, 0, 0.025],
  [1.671, 0.092, 0.088, 0, 0.020],
  [1.694, 0.098, 0.095, 0, 0.011],
  [1.72, 0.104, 0.102, 0, 0.006],
  [1.742, 0.102, 0.100, 0, 0],
  [1.761, 0.098, 0.096, 0, -0.001],
  [1.78, 0.096, 0.098, 0, -0.005],
  [1.806, 0.092, 0.096, 0, -0.008],
  [1.831, 0.076, 0.084, 0, -0.011],
  [1.852, 0.045, 0.050, 0, -0.012],
  [1.86, 0.001, 0.001, 0, -0.013]
];

/**
 * Interpolates the skull loft at an arbitrary bind height.
 *
 * @param {number} y - Bind-space height.
 * @returns {{width: number, depth: number, cx: number, cz: number}}
 */
export function skullAt(y) {
  const s = SKULL_SECTIONS;
  if (y <= s[0][0]) return { width: s[0][1], depth: s[0][2], cx: s[0][3], cz: s[0][4] };
  for (let i = 0; i < s.length - 1; i++) {
    const [ya, wa, da, xa, za] = s[i];
    const [yb, wb, db, xb, zb] = s[i + 1];
    if (y >= ya && y <= yb) {
      const t = (y - ya) / (yb - ya);
      return {
        width: wa + (wb - wa) * t,
        depth: da + (db - da) * t,
        cx: xa + (xb - xa) * t,
        cz: za + (zb - za) * t
      };
    }
  }
  const last = s[s.length - 1];
  return { width: last[1], depth: last[2], cx: last[3], cz: last[4] };
}

/**
 * Builds a shell that follows the skull at a fixed outward offset, expressed in
 * the `head` bone's local frame so it can be attached straight to that bone.
 *
 * @param {object} options
 * @param {number} options.fromY - Lowest bind height to cover.
 * @param {number} options.toY - Highest bind height to cover.
 * @param {number} options.offset - Outward clearance, metres.
 * @param {number[]} [options.extra] - Extra bind heights to sample.
 * @returns {number[][]} `sculpt` sections in head-local space.
 */
export function skullShell({ fromY, toY, offset, extra = [] }) {
  const heights = new Set([fromY, toY, ...extra]);
  for (const [y] of SKULL_SECTIONS) if (y > fromY && y < toY) heights.add(y);
  return [...heights].sort((a, b) => a - b).map((y) => {
    const { width, depth, cx, cz } = skullAt(y);
    return [y - HEAD_BONE_BIND_Y, width + offset, depth + offset, cx, cz];
  });
}
