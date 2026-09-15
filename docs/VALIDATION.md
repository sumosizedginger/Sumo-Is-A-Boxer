# Validation

## Commands

```bash
npm install
npm test                 # game suite (tests/*.test.js)
npm run build
cd engine && npm test    # engine suite, including tests/voxel.test.js
```

Node is pinned to `24.21.0`.

## URLs

| URL | Role |
|---|---|
| http://127.0.0.1:5180 | Play |
| `?validation=voxel` | Voxel inspection |
| `?validation=models` | Pose model inspection (guide + voxel) |
| `?validation=topology` | Guide topology overlay |

Voxel presentation modes (via `game.validation.voxel.setPresentation`):

`GUIDE` · `VOXEL` · `WIREFRAME` · `SEMANTIC` · `SILHOUETTE` · `PERFORMANCE`

Hero views for capture: front, rear, left/right profile, front/rear 3/4, high, low, face / belly / thigh / joint closeups (`PRESETS.voxel_hero`, `voxel_face`, `voxel_belly`).

## Metrics

`opponent.diagnostics().voxel` and `game.validation.voxel.metrics()`:

occupied, surface, visible faces, voxelSize, generationMs, drawCalls.

Renderer: `renderer.info.render.calls`, `.triangles`, frame p50/p95 from the existing timing harness.

## Artifact retention

A milestone keeps a manifest, certification JSON, performance summary, test summary, and **3–10** representative captures. Iteration dumps stay gitignored. See [ARTIFACT_POLICY.md](ARTIFACT_POLICY.md).
