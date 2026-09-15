import { PerspectiveCamera, Vector3 } from 'three';

function preset(position, target, fov, subject, viewmodel = false) {
  const camera = new PerspectiveCamera(fov);
  camera.position.fromArray(position);
  camera.lookAt(new Vector3(...target));
  return {
    camera: { position, quaternion: camera.quaternion.toArray(), fov, target }, subject,
    player: { pose: 'guardHigh', position: [0, 0, 2], yaw: 0, viewmodelVisible: viewmodel },
    opponent: { pose: 'stance', position: [0, 0, 0], yaw: Math.PI, visible: subject === 'skin' },
    simulation: { frozen: true, seed: 1111, advancementSeconds: 0 },
    posePreparation: { steps: 60, dt: 1 / 60, description: 'Presentation-only settling after reset, before capture; no match.step.' },
    lighting: { existingOnly: true, updateTime: 0, frozen: true },
    overlays: { hudHidden: true, damageSuppressed: true },
    particles: { dustHidden: true, sparksCleared: true, updatesDisabled: true }
  };
}

export const PRESETS = {
  canvas_close: preset([0, .38, 1.2], [0, 0, 0], 55, 'canvas'),
  canvas_gameplay: preset([0, 1.65, 2.6], [0, 0, -.8], 68, 'canvas'),
  gloves_close: preset([0, 1.65, 2], [0, 1.65, 0], 45, 'skin', true),
  gloves_gameplay: preset([0, 1.65, 2], [0, 1.65, 0], 68, 'skin', true),
  fists_close: preset([0, 1.65, 2], [0, 1.65, 0], 45, 'skin', true),
  fists_gameplay: preset([0, 1.65, 2], [0, 1.65, 0], 68, 'skin', true),
  voxel_hero: preset([0, 1.15, 3.2], [0, 1.05, 0], 48, 'skin'),
  voxel_face: preset([0.12, 1.74, 0.55], [0, 1.72, 0.05], 32, 'skin'),
  voxel_belly: preset([0.2, 1.22, 1.1], [0, 1.18, 0.05], 40, 'skin'),
  skin_close: preset([.5, 1.6, 1.05], [0, 1.48, 0], 42, 'skin'),
  skin_gameplay: preset([0, 1.65, 2.3], [0, 1.1, 0], 62, 'skin'),
  concrete_close: preset([3.4, -.55, -10.2], [3.4, -1.05, -11.5], 55, 'concrete'),
  concrete_gameplay: preset([3.4, .6, -8.9], [3.4, -1.05, -11.5], 62, 'concrete'),
  steel_close: preset([.5, 4.08, -3.6], [.5, 4.25, -4.2], 45, 'steel'),
  steel_gameplay: preset([.5, 1.65, -3.8], [.5, 4.25, -4.2], 30, 'steel')
};

export function motionCamera(presetName, progress) {
  const base = PRESETS[presetName].camera;
  const camera = new PerspectiveCamera(base.fov);
  const x = (progress - .5) * .5;
  camera.position.fromArray(base.position);
  camera.position.x += x;
  camera.lookAt(new Vector3(...base.target));
  return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: base.fov };
}
