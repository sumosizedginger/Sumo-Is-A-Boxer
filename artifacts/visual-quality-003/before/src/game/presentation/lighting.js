/**
 * SUMO IS A BOXER — Light rig.
 *
 * The whole visual thesis of this venue is CONTRAST: four hot industrial lamps
 * directly over the canvas, a red and a blue spill at the working corners, and
 * essentially nothing else. The warehouse is not dark because it is unlit; it
 * is dark because the fixtures that exist are aimed at the ring.
 *
 * Every fixture is positioned by asking the COMPILED SCENE where its authored
 * lamp node ended up, so a light can never drift away from the housing that is
 * supposed to be emitting it.
 */

import {
  SpotLight, PointLight, HemisphereLight, AmbientLight, Object3D, Color, FogExp2
} from 'three';

export const FOG_COLOR = 0x05060b;

/** The warehouse slab, in the game's canvas-relative frame. */
const VENUE_FLOOR = -1.05;

/**
 * Builds the light rig into a scene.
 *
 * @param {object} options
 * @param {object} options.scene - Three.Scene.
 * @param {object} options.presentation - Arena presentation (for scene-authored positions).
 * @returns {object} Rig handle with update() and dispose().
 */
export function createLightRig({ scene, presentation }) {
  const group = new Object3D();
  group.name = 'light-rig';
  scene.add(group);

  scene.fog = new FogExp2(FOG_COLOR, 0.032);
  scene.background = new Color(FOG_COLOR);

  const disposables = [];
  const lamps = [];

  // --- the little that fills the dark ---------------------------------------
  // Just enough sky/ground separation that concrete, steel and painted metal
  // still read as different materials out in the dark, without lifting the
  // room into a lit interior.
  const hemi = new HemisphereLight(0x667b9a, 0x282019, 0.48);
  group.add(hemi);
  const ambient = new AmbientLight(0x344158, 0.16);
  group.add(ambient);

  /**
   * Adds a spot light aimed at a point.
   *
   * @param {object} options
   * @returns {SpotLight}
   */
  function spot({ at, target, color, intensity, angle, penumbra, decay = 1.65, distance = 0, shadow = false }) {
    const light = new SpotLight(color, intensity, distance, angle, penumbra, decay);
    light.position.set(at[0], at[1], at[2]);
    light.target.position.set(target[0], target[1], target[2]);
    group.add(light);
    group.add(light.target);
    if (shadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.6;
      light.shadow.camera.far = 14;
      light.shadow.bias = -0.00025;
      light.shadow.normalBias = 0.012;
      light.shadow.radius = 4.0;
    }
    disposables.push(light);
    return light;
  }

  // --- the four hot lamps over the canvas -----------------------------------
  const lampPids = ['ring-lamp-key-nw', 'ring-lamp-key-ne', 'ring-lamp-key-se', 'ring-lamp-key-sw'];
  lampPids.forEach((pid, index) => {
    const at = presentation.positionOf(pid) ?? [0, 3.7, 0];
    // The bulb sits below the housing origin; light where the bulb is.
    const bulb = [at[0], at[1] - 0.24, at[2]];
    const light = spot({
      at: bulb,
      target: [at[0] * 0.25, 0, at[2] * 0.25],
      color: 0xffd2a1,
      intensity: 31,
      angle: 0.78,
      penumbra: 0.82,
      decay: 1.55,
      distance: 16,
      // None of the four carries a shadow map. The tight overhead key below is
      // the single shadow-casting light in the venue: one shadow pass buys
      // grounded fighters and rope shadows, and four would buy four passes of
      // very nearly the same picture.
      shadow: false
    });
    lamps.push({ light, base: light.intensity, phase: index * 1.7, flicker: index === 1 ? 1 : 0.22 });
  });

  // A tight overhead key straight down the middle. This is the light that
  // carves the fighters' shoulders out of the dark.
  const key = spot({
    at: [-0.8, 5.2, 0.65],
    target: [0, 0, 0],
    color: 0xffe0b8,
    intensity: 68,
    angle: 0.62,
    penumbra: 0.8,
    decay: 1.4,
    distance: 18,
    shadow: true
  });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.far = 12;
  lamps.push({ light: key, base: key.intensity, phase: 0.4, flicker: 0.12 });

  // --- corner spill ---------------------------------------------------------
  function practical({ at, color, intensity, distance, decay = 1.8 }) {
    const light = new PointLight(color, intensity, distance, decay);
    light.position.set(at[0], at[1], at[2]);
    group.add(light);
    disposables.push(light);
    return light;
  }

  const redAt = presentation.positionOf('corner-lamp-red') ?? [-4.6, 3.9, -4.6];
  const blueAt = presentation.positionOf('corner-lamp-blue') ?? [4.6, 3.9, 4.6];
  const redSpot = spot({
    at: [redAt[0], redAt[1] - 0.2, redAt[2]],
    target: [-1.8, 0.4, -1.8],
    color: 0xff3a1e,
    intensity: 46,
    angle: 0.6,
    penumbra: 0.75,
    decay: 1.5,
    distance: 15
  });
  const blueSpot = spot({
    at: [blueAt[0], blueAt[1] - 0.2, blueAt[2]],
    target: [1.8, 0.4, 1.8],
    color: 0x2f68ff,
    intensity: 46,
    angle: 0.6,
    penumbra: 0.75,
    decay: 1.5,
    distance: 15
  });
  // Low bounce at each corner so the padding itself glows. These, and the
  // practicals below, are created for their effect on the room; `practical`
  // parents them and registers them for disposal, so nothing needs to hold a
  // reference to them afterwards.
  practical({ at: [-3.3, 0.9, -3.3], color: 0xff2d14, intensity: 6.5, distance: 8 });
  practical({ at: [3.3, 0.9, 3.3], color: 0x2b5cff, intensity: 6.5, distance: 8 });

  // --- the working end of the room -----------------------------------------
  // Two caged work lamps, placed by their authored scene nodes. They keep the
  // training corner and the loading door from being authored content nobody
  // ever sees, without lifting the darkness the ring needs.
  for (const [pid, fallback] of [
    ['training-lamp', [-11.6, 2.65, -8.3]],
    ['door-lamp', [3.4, 2.45, -11.4]]
  ]) {
    const at = presentation.positionOf(pid) ?? fallback;
    const light = spot({
      at: [at[0], at[1] - 0.22, at[2]],
      target: [at[0], VENUE_FLOOR, at[2]],
      color: 0xffc98d,
      intensity: 30,
      angle: 0.92,
      penumbra: 0.7,
      decay: 1.6,
      distance: 12
    });
    lamps.push({ light, base: light.intensity, phase: 3.1, flicker: 0.5 });
  }

  // --- far practicals: depth cues in the darkness ---------------------------
  practical({ at: [6.4, VENUE_FLOOR + 2.6, -12.7], color: 0x27c05a, intensity: 5.5, distance: 10 });
  practical({ at: [0, 0.6, -12.0], color: 0x2a3a5e, intensity: 34, distance: 17, decay: 1.3 });
  // Two cold, very dim wall washes. Their whole job is to keep the columns,
  // trusses and dado paint as SILHOUETTES WITH EDGES instead of black holes —
  // a warehouse you cannot see the shape of is not a venue, it is a void.
  practical({ at: [-12.6, 4.6, -3.0], color: 0x39496e, intensity: 62, distance: 26, decay: 1.25 });
  practical({ at: [12.6, 4.6, 3.4], color: 0x334268, intensity: 58, distance: 26, decay: 1.25 });
  // A warm bounce off the canvas, thrown back up at the underside of the roof
  // and the tops of the crowd. Cheap substitute for the GI this renderer does
  // not do, and it is what stops the ceiling reading as outer space.
  practical({ at: [0, 0.9, 0], color: 0x6b4526, intensity: 34, distance: 22, decay: 1.1 });

  let elapsed = 0;
  let flashAmount = 0;

  return {
    group,
    key,
    redSpot,
    blueSpot,

    /**
     * Cheap, deterministic lamp instability plus the decaying hit flash. Old
     * fixtures on a stolen supply do not sit perfectly still, and a very small
     * amount of it sells the venue.
     *
     * `base` is never mutated, so nothing here can drift or compound across a
     * long match or a rematch.
     *
     * @param {number} dt
     */
    update(dt) {
      elapsed += dt;
      flashAmount = Math.max(0, flashAmount - dt * 6.5);
      for (const lamp of lamps) {
        const wobble =
          Math.sin(elapsed * 7.3 + lamp.phase) * 0.012 +
          Math.sin(elapsed * 23.1 + lamp.phase * 2.4) * 0.008;
        const dip = lamp.flicker > 0.5 && Math.sin(elapsed * 2.1 + lamp.phase) > 0.985 ? -0.25 : 0;
        lamp.light.intensity = lamp.base * (1 + wobble * lamp.flicker * 4 + dip + flashAmount * 0.08);
      }
    },

    /**
     * Pushes a hit flash through the rig: the ring lamps punch up for an
     * instant. Clamped so repeated hits cannot become a strobe.
     *
     * @param {number} amount - 0..1
     */
    flash(amount) {
      flashAmount = Math.min(0.55, Math.max(flashAmount, Math.max(0, Math.min(1, amount))));
    },

    dispose() {
      for (const light of disposables) {
        light.parent?.remove(light);
        light.dispose?.();
        if (light.target) light.target.parent?.remove(light.target);
        if (light.shadow?.map) light.shadow.map.dispose();
      }
      disposables.length = 0;
      hemi.parent?.remove(hemi);
      ambient.parent?.remove(ambient);
      group.parent?.remove(group);
      scene.fog = null;
    }
  };
}
