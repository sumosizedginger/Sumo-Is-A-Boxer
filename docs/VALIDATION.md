# Validation

## Commands

```bash
npm install
npm test                 # game suite (tests/*.test.js)
npm run build
cd engine && npm test    # engine suite, including tests/voxel.test.js
```

Capture 15 canonical views:
```bash
node scripts/capture-voxel-hero-002.mjs
```

Node is pinned to `24.21.0`.

## URLs

| URL | Role |
|---|---|
| http://127.0.0.1:5180 | Play |
| `?validation=voxel` | Voxel hero inspection (`VOXEL_CLAY` by default) |
| `?validation=models` | Pose model inspection (guide + voxel) |
| `?validation=topology` | Guide topology overlay |

## Voxel Presentation Modes (via `game.validation.voxel.setPresentation`)

- `VOXEL_CLAY` (default for voxel validation): 3-point neutral clay lighting, gray backdrop `0x3a3f47`, no fog, matte clay material.
- `VOXEL_COLOR`: Vertex-colored hero with cavity shading.
- `SILHOUETTE`: Solid black hero (`0x050505`) against clean bright white background (`0xeef0f2`).
- `GUIDE`: Smooth guide mesh only.
- `WIREFRAME`: Wireframe mode on smooth guide mesh.
- `GRID`: Wireframe mode on instanced voxel cells.
- `SEMANTIC`: Anatomical region color inspection.
- `PERFORMANCE`: Live gameplay arena lighting.

## 15 Canonical Validation View Presets (`PRESETS`)

1. `clay_front`: Full body front view, clay mode, `sumo_neutral` pose.
2. `clay_rear`: Full body back view showing dorsal spinal groove and gluteal masses.
3. `clay_profile_left`: Lateral view demonstrating abdominal overhang (+0.44m) and calf curve.
4. `clay_profile_right`: Opposite lateral view demonstrating mass balance and forward torso pitch.
5. `clay_three_quarter_front_left`: Heroic 3/4 perspective emphasizing torso, thigh, and arm volumes.
6. `clay_three_quarter_rear_left`: 3/4 dorsal perspective showcasing shoulder blades and flank pads.
7. `silhouette_front`: Pure black-on-white frontal silhouette truth test.
8. `silhouette_profile`: Pure black-on-white profile silhouette truth test.
9. `close_face`: Facial sculpt detail: brow shelf, orbital hollows, stepped nose, jaw, chin.
10. `close_belly`: Abdominal roll, navel depression, and lower pelvic fold.
11. `close_arm`: Bicep, tricep, flared elbow, and thick forearm transitions.
12. `close_thigh`: Colossal quadricep bulk and knee joint junction.
13. `close_hand`: Heavy blocky fists and wrist transition.
14. `close_grid`: High-magnification surface view showing 0.012m unit cube microstructure.
15. `hero_production`: Final hero render with color, cavity occlusion, and studio lighting.

## Artifact Retention

Artifacts for milestone `VOXEL-HERO-002` are generated into `artifacts/voxel-hero-002/`:
- `MANIFEST.json`
- `metrics.json`
- 15 canonical PNG captures (`clay-front.png`, `silhouette-front.png`, etc.)
