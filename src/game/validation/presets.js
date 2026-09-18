import { PerspectiveCamera, Vector3 } from 'three';

function preset(position, target, fov, subject, viewmodel = false, options = {}) {
  const camera = new PerspectiveCamera(fov);
  camera.position.fromArray(position);
  camera.lookAt(new Vector3(...target));
  const pose = options.pose ?? 'stance';
  const yaw = options.yaw ?? Math.PI;
  return {
    camera: { position, quaternion: camera.quaternion.toArray(), fov, target }, subject,
    player: { pose: 'guardHigh', position: [0, 0, 2], yaw: 0, viewmodelVisible: viewmodel },
    opponent: { pose, position: [0, 0, 0], yaw, visible: subject === 'skin' },
    presentationMode: options.presentationMode ?? null,
    simulation: { frozen: true, seed: 1111, advancementSeconds: 0 },
    posePreparation: { steps: 60, dt: 1 / 60, description: 'Presentation-only settling after reset, before capture; no match.step.' },
    lighting: { existingOnly: true, updateTime: 0, frozen: true, ...options.lighting },
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

  // Hero sculpt & visual ceiling presets
  voxel_hero: preset([0, 1.05, 3.1], [0, 1.02, 0], 48, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  voxel_face: preset([0.08, 1.73, 0.70], [0, 1.72, 0.05], 32, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  voxel_belly: preset([0.38, 1.15, 1.30], [0, 1.12, 0.15], 40, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),

  // Canonical views for VOXEL-HERO-003
  guide_front: preset([0, 1.05, 3.1], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'GUIDE' }),
  guide_rear: preset([0, 1.05, -3.1], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'GUIDE' }),
  guide_profile: preset([3.1, 1.05, 0], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'GUIDE' }),
  guide_three_quarter_front: preset([2.2, 1.05, 2.2], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'GUIDE' }),
  guide_three_quarter_rear: preset([2.2, 1.05, -2.2], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'GUIDE' }),

  clay_front: preset([0, 1.05, 3.1], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_rear: preset([0, 1.05, -3.1], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_profile: preset([3.1, 1.05, 0], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_profile_left: preset([3.1, 1.05, 0], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_profile_right: preset([-3.1, 1.05, 0], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_three_quarter_front: preset([2.2, 1.05, 2.2], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_three_quarter_front_left: preset([2.2, 1.05, 2.2], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_three_quarter_rear: preset([2.2, 1.05, -2.2], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  clay_three_quarter_rear_left: preset([2.2, 1.05, -2.2], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),

  silhouette_front: preset([0, 1.05, 3.1], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'SILHOUETTE' }),
  silhouette_profile: preset([3.1, 1.05, 0], [0, 1.02, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'SILHOUETTE' }),

  close_head: preset([0.05, 1.74, 0.85], [0, 1.73, 0.05], 28, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_face: preset([0.04, 1.70, 0.85], [0, 1.69, 0.08], 28, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_shoulder: preset([0.48, 1.48, 1.05], [0.30, 1.44, 0.02], 34, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_belly: preset([0.42, 1.10, 1.55], [0, 1.12, 0.38], 36, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_pelvis: preset([0.0, 0.95, -1.60], [0, 0.98, -0.05], 36, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_arm: preset([0.70, 0.95, 0.65], [0.41, 0.90, 0.02], 34, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_thigh: preset([-0.25, 0.65, 0.70], [-0.25, 0.65, 0.0], 34, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_thigh_knee: preset([-0.30, 0.45, 0.65], [-0.30, 0.45, -0.10], 32, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_hand: preset([-0.78, 0.61, 1.15], [-0.68, 0.59, 0.00], 22, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_foot: preset([-0.38, 0.16, 0.70], [-0.38, 0.08, 0.00], 28, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  close_grid: preset([0.20, 1.08, 0.75], [0.05, 1.05, 0.38], 24, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_CLAY' }),
  hero_production: preset([0.4, 1.15, 2.8], [0, 1.05, 0], 46, 'skin', false, { pose: 'sumo_neutral', presentationMode: 'VOXEL_COLOR' }),

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
